import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { BR_STATES, BR_STATE_BY_IBGE, stateGeoCode, type Observation } from '@h1n1/core';
import type { Connector, FetchContext, NormalizeContext, RawSnapshot } from '../types.js';
import { fetchJson, writeRawFile } from '../http.js';
import { makeObs, toInt } from '../util.js';

export const IBGE_LICENSE = 'IBGE — dados públicos (verificar termos em https://www.ibge.gov.br/acesso-informacao/institucional/termos-de-uso.html)';
export const IBGE_ESTADOS_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados';
export const INDICATOR_ID = 'ibge_population_estimate';
export const DEFAULT_YEARS = [2021, 2022, 2023, 2024, 2025];

export function ibgeUrl(year: number): string {
  return `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/${year}/variaveis/9324?localidades=N1[all]|N3[all]`;
}

const Serie = z.object({
  localidade: z.object({ id: z.string(), nivel: z.object({ id: z.string() }), nome: z.string() }),
  serie: z.record(z.string()),
});
export const IbgeResponse = z.array(z.object({
  id: z.string(),
  variavel: z.string(),
  resultados: z.array(z.object({ series: z.array(Serie) })),
}));
export const IbgeEstado = z.object({ id: z.number(), sigla: z.string(), nome: z.string() });

export interface IbgeEnvelope { years: Record<string, unknown>; estados: unknown }

/** Confere que a API de localidades devolve exatamente as 27 UFs do core (BR_STATES). */
export function checkEstados(estados: unknown): { ok: boolean; missing: string[]; unexpected: string[] } {
  const list = z.array(IbgeEstado).parse(estados);
  const api = new Map(list.map((e) => [String(e.id), e.sigla]));
  const missing = BR_STATES.filter((s) => api.get(s.ibge) !== s.uf).map((s) => s.uf);
  const unexpected = list.filter((e) => BR_STATE_BY_IBGE.get(String(e.id))?.uf !== e.sigla).map((e) => e.sigla);
  return { ok: missing.length === 0 && unexpected.length === 0 && list.length === 27, missing, unexpected };
}

export function normalizeIbge(years: Record<string, unknown>, snapshotId: string): Observation[] {
  const out: Observation[] = [];
  for (const [year, payload] of Object.entries(years)) {
    const parsed = IbgeResponse.parse(payload);
    for (const v of parsed) for (const res of v.resultados) for (const s of res.series) {
      const value = toInt(s.serie[year]);
      if (value === null) continue;
      const base = { snapshot_id: snapshotId, indicator_id: INDICATOR_ID, period_type: 'year' as const, period: year, value, update_status: 'final' as const };
      if (s.localidade.nivel.id === 'N1') out.push(makeObs({ ...base, geo_level: 'country', geo_code: 'BRA' }));
      else if (s.localidade.nivel.id === 'N3') {
        const st = BR_STATE_BY_IBGE.get(s.localidade.id);
        if (st) out.push(makeObs({ ...base, geo_level: 'state', geo_code: stateGeoCode(st.uf) }));
      }
    }
  }
  return out;
}

export const ibgeConnector: Connector = {
  id: 'ibge',
  sourceId: 'BR-14',
  indicators: [INDICATOR_ID],

  async fetch(ctx: FetchContext): Promise<RawSnapshot> {
    const years = ctx.options.years?.length ? ctx.options.years : DEFAULT_YEARS;
    const fetched_at = new Date().toISOString();
    const env: IbgeEnvelope = { years: {}, estados: null };
    const urls: string[] = [];
    for (const y of years) {
      const url = ibgeUrl(y);
      urls.push(url);
      const data = await fetchJson<unknown[]>(url);
      if (!Array.isArray(data) || data.length === 0) { ctx.log(`[ibge] ${y}: sem resposta (ano sem estimativa), ignorado`); continue; }
      env.years[String(y)] = data;
      ctx.log(`[ibge] ${y}: ok`);
    }
    urls.push(IBGE_ESTADOS_URL);
    env.estados = await fetchJson(IBGE_ESTADOS_URL);
    const check = checkEstados(env.estados);
    if (!check.ok) throw new Error(`ibge: UFs da API não batem com BR_STATES (faltam: ${check.missing.join(',')}; inesperadas: ${check.unexpected.join(',')})`);
    ctx.log('[ibge] localidades/estados: 27 UFs conferem com BR_STATES');
    const yearsOk = Object.keys(env.years).map(Number);
    if (!yearsOk.length) throw new Error('ibge: nenhum ano com dados');
    const path = join(ctx.tmpDir, `ibge_${Date.now()}.json`);
    const w = await writeRawFile(path, JSON.stringify(env), 'application/json');
    return {
      url: urls[0]!, urls, path, ext: 'json', sha256: w.sha256, bytes: w.bytes, content_type: 'application/json', license: IBGE_LICENSE,
      data_as_of: `${Math.max(...yearsOk)}-07-01`, fetched_at, extra: { years_requested: years, years_available: yearsOk },
    };
  },

  async normalize(raw: RawSnapshot, ctx: NormalizeContext): Promise<Observation[]> {
    const env = JSON.parse(await readFile(raw.path, 'utf8')) as IbgeEnvelope;
    const obs = normalizeIbge(env.years, ctx.snapshotId);
    ctx.countRowsIn(obs.length);
    ctx.report.years = Object.keys(env.years);
    return obs;
  },
};
