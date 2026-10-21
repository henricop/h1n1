import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { isoWeekStart, weekPeriodId, type Observation, type UpdateStatus } from '@h1n1/core';
import type { Connector, FetchContext, GeoEntry, NormalizeContext, RawSnapshot } from '../types.js';
import { fetchJson, writeRawFile } from '../http.js';
import { addDays, isoDate, makeObs, percent } from '../util.js';

export const FLUNET_BASE_URL = 'https://xmart-api-public.who.int/FLUMART/VIW_FNT';
export const FLUNET_LICENSE = 'WHO FluNet — verificar termos de uso (https://www.who.int/about/policies/publishing/data-policy)';
const PAGE = 5000;
const PROVISIONAL_WEEKS = 4;

const num = z.number().nullable().optional();
export const FluNetRow = z.object({
  COUNTRY_CODE: z.string(),
  COUNTRY_AREA_TERRITORY: z.string().nullable().optional(),
  ISO2: z.string().nullable().optional(),
  ISO_YEAR: z.number().int(),
  ISO_WEEK: z.number().int(),
  ISO_WEEKSTARTDATE: z.string(),
  /** valores conhecidos em KNOWN_ORIGINS; outros não derrubam a execução (flag origin_source_unknown) */
  ORIGIN_SOURCE: z.string(),
  SPEC_PROCESSED_NB: num,
  AH1N12009: num,
  AH3: num,
  INF_A: num,
  ANOTSUBTYPED: num,
  ANOTSUBTYPABLE: num,
  INF_B: num,
  INF_ALL: num,
});
export type FluNetRow = z.infer<typeof FluNetRow>;

/** Origens previstas no stratum_schema da ontologia (origin_source). */
export const KNOWN_ORIGINS: ReadonlySet<string> = new Set(['SENTINEL', 'NONSENTINEL', 'NOTDEFINED']);
export const COUNTRY_RE = /^[A-Z]{3}$/;

export interface FluNetStats {
  rows: number;
  /** linhas repetidas por (COUNTRY_CODE, ISO_YEAR, ISO_WEEK, ORIGIN_SOURCE); só a primeira é usada */
  duplicates: number;
  duplicate_samples: string[];
  /** linhas com ORIGIN_SOURCE fora de KNOWN_ORIGINS: entram no total (flag origin_source_unknown), sem estrato próprio */
  origin_source_unknown: number;
  unknown_origins: Record<string, number>;
}
export const newFluNetStats = (): FluNetStats => ({ rows: 0, duplicates: 0, duplicate_samples: [], origin_source_unknown: 0, unknown_origins: {} });

/** Normaliza e valida a lista de `--country` (ISO3, três letras maiúsculas) antes de montar qualquer filtro OData. */
export function validateCountries(list: string[]): string[] {
  const out = list.map((c) => c.trim().toUpperCase());
  const bad = out.filter((c) => !COUNTRY_RE.test(c));
  if (bad.length) throw new Error(`flunet: código(s) de país inválido(s) em --country (esperado ISO3, ex.: BRA): ${bad.join(', ')}`);
  return [...new Set(out)];
}

/** Indicadores de contagem: coluna FluNet → id do indicador */
export const COUNT_COLUMNS = {
  SPEC_PROCESSED_NB: 'flunet_specimens_processed',
  AH1N12009: 'flunet_ah1n1pdm09_detections',
  AH3: 'flunet_ah3_detections',
  INF_A: 'flunet_inf_a_detections',
  ANOTSUBTYPED: 'flunet_inf_a_not_subtyped',
  ANOTSUBTYPABLE: 'flunet_inf_a_not_subtypable',
  INF_B: 'flunet_inf_b_detections',
  INF_ALL: 'flunet_inf_all_detections',
} as const;
type CountColumn = keyof typeof COUNT_COLUMNS;
const COLS = Object.keys(COUNT_COLUMNS) as CountColumn[];

export const FLUNET_INDICATORS = [
  ...Object.values(COUNT_COLUMNS),
  'flunet_ah1n1pdm09_share_of_inf_a',
  'flunet_influenza_positivity',
];

export function flunetUrl(country: string, skip = 0): string {
  if (!COUNTRY_RE.test(country)) throw new Error(`flunet: código de país inválido: ${country}`);
  const filter = encodeURIComponent(`COUNTRY_CODE eq '${country}'`);
  return `${FLUNET_BASE_URL}?$filter=${filter}&$orderby=ISO_WEEKSTARTDATE,ORIGIN_SOURCE&$top=${PAGE}&$skip=${skip}`;
}

interface ODataPage { value: unknown[]; '@odata.nextLink'?: string }

async function fetchCountry(country: string, log: (m: string) => void): Promise<{ rows: unknown[]; urls: string[] }> {
  const rows: unknown[] = [];
  const urls: string[] = [];
  let url: string | null = flunetUrl(country, 0);
  let skip = 0;
  while (url) {
    urls.push(url);
    const page: ODataPage = await fetchJson<ODataPage>(url);
    rows.push(...page.value);
    if (page['@odata.nextLink']) url = page['@odata.nextLink'];
    else if (page.value.length >= PAGE) { skip += page.value.length; url = flunetUrl(country, skip); }
    else url = null;
  }
  log(`[flunet] ${country}: ${rows.length} linha(s) em ${urls.length} requisição(ões)${rows.length === 0 ? ' — AVISO: nenhum dado (o FluNet pode usar outro código, ex.: Reino Unido é reportado por nação: X09–X12)' : ''}`);
  return { rows, urls };
}

/** Soma ignorando nulos; devolve null quando todos são nulos (null = ausente, nunca zero). */
function sumNullable(values: Array<number | null | undefined>): number | null {
  let s: number | null = null;
  for (const v of values) if (v !== null && v !== undefined) s = (s ?? 0) + v;
  return s;
}

function maxDate(rows: FluNetRow[]): string | null {
  let max: string | null = null;
  for (const r of rows) { const d = r.ISO_WEEKSTARTDATE.slice(0, 10); if (!max || d > max) max = d; }
  return max;
}

export function dataAsOfFromRows(rows: FluNetRow[]): string | null {
  const m = maxDate(rows);
  return m ? addDays(m, 6) : null;
}

/**
 * Gera observações a partir de linhas FluNet (sem supressão: isso é da camada de publicação).
 * Linhas duplicadas por (COUNTRY_CODE, ISO_YEAR, ISO_WEEK, ORIGIN_SOURCE) são descartadas (só a primeira conta) e
 * contadas em stats.duplicates — o conector transforma isso em quarentena. ORIGIN_SOURCE desconhecido entra no
 * total com a flag 'origin_source_unknown' e não gera estrato (valor fora do stratum_schema).
 */
export function normalizeFluNetRows(rawRows: unknown[], snapshotId: string, geo?: GeoEntry[], stats?: FluNetStats): Observation[] {
  const st = stats ?? newFluNetStats();
  const rows: FluNetRow[] = [];
  const seen = new Set<string>();
  for (const raw of rawRows) {
    const r = FluNetRow.parse(raw);
    st.rows++;
    const key = `${r.COUNTRY_CODE}|${r.ISO_YEAR}|${r.ISO_WEEK}|${r.ORIGIN_SOURCE}`;
    if (seen.has(key)) {
      st.duplicates++;
      if (st.duplicate_samples.length < 5) st.duplicate_samples.push(key);
      continue;
    }
    seen.add(key);
    if (!KNOWN_ORIGINS.has(r.ORIGIN_SOURCE)) {
      st.origin_source_unknown++;
      st.unknown_origins[r.ORIGIN_SOURCE] = (st.unknown_origins[r.ORIGIN_SOURCE] ?? 0) + 1;
    }
    rows.push(r);
  }
  const byCountry = new Map<string, FluNetRow[]>();
  for (const r of rows) {
    const arr = byCountry.get(r.COUNTRY_CODE);
    if (arr) arr.push(r); else byCountry.set(r.COUNTRY_CODE, [r]);
  }
  const out: Observation[] = [];
  for (const [country, crows] of byCountry) {
    const name = crows.find((r) => r.COUNTRY_AREA_TERRITORY)?.COUNTRY_AREA_TERRITORY ?? country;
    geo?.push({ code: country, level: 'country', name, parent_code: 'WLD', iso2: crows[0]?.ISO2 ?? null });
    const latest = maxDate(crows)!;
    const provisionalFrom = addDays(latest, -7 * (PROVISIONAL_WEEKS - 1));
    const byWeek = new Map<string, FluNetRow[]>();
    for (const r of crows) {
      const k = weekPeriodId(r.ISO_YEAR, r.ISO_WEEK);
      const arr = byWeek.get(k);
      if (arr) arr.push(r); else byWeek.set(k, [r]);
    }
    for (const [period, wrows] of byWeek) {
      const { year, week } = { year: wrows[0]!.ISO_YEAR, week: wrows[0]!.ISO_WEEK };
      const weekStart = isoDate(isoWeekStart(year, week));
      const update_status: UpdateStatus = weekStart >= provisionalFrom ? 'provisional' : 'final';
      const unknownInWeek = wrows.some((r) => !KNOWN_ORIGINS.has(r.ORIGIN_SOURCE));
      const groups: Array<{ stratum: Record<string, string>; rows: FluNetRow[]; flags: string[] }> = [{ stratum: {}, rows: wrows, flags: unknownInWeek ? ['origin_source_unknown'] : [] }];
      for (const r of wrows) if (KNOWN_ORIGINS.has(r.ORIGIN_SOURCE)) groups.push({ stratum: { origin_source: r.ORIGIN_SOURCE }, rows: [r], flags: [] });
      for (const g of groups) {
        const base = { snapshot_id: snapshotId, geo_level: 'country' as const, geo_code: country, period_type: 'isoweek' as const, period, stratum: g.stratum, update_status };
        const totals: Partial<Record<CountColumn, number | null>> = {};
        for (const col of COLS) {
          const v = sumNullable(g.rows.map((r) => r[col]));
          totals[col] = v;
          if (v !== null) out.push(makeObs({ ...base, indicator_id: COUNT_COLUMNS[col], value: v, quality_flags: [...g.flags] }));
        }
        const share = percent(totals.AH1N12009 ?? null, totals.INF_A ?? null, 20);
        if (share) out.push(makeObs({ ...base, indicator_id: 'flunet_ah1n1pdm09_share_of_inf_a', value: share.value, denominator: share.denominator, quality_flags: [...g.flags, ...share.quality_flags] }));
        const pos = percent(totals.INF_ALL ?? null, totals.SPEC_PROCESSED_NB ?? null, 20);
        if (pos) out.push(makeObs({ ...base, indicator_id: 'flunet_influenza_positivity', value: pos.value, denominator: pos.denominator, quality_flags: [...g.flags, ...pos.quality_flags] }));
      }
    }
  }
  return out;
}

export interface FluNetEnvelope { countries: string[]; urls: string[]; value: unknown[] }

export const flunetConnector: Connector = {
  id: 'flunet',
  sourceId: 'INT-01',
  indicators: FLUNET_INDICATORS,

  async fetch(ctx: FetchContext): Promise<RawSnapshot> {
    const countries = validateCountries(ctx.options.countries?.length ? ctx.options.countries : ['BRA']);
    const fetched_at = new Date().toISOString();
    const env: FluNetEnvelope = { countries, urls: [], value: [] };
    for (const c of countries) {
      const { rows, urls } = await fetchCountry(c, ctx.log);
      env.urls.push(...urls);
      env.value.push(...rows);
    }
    const parsed = env.value.map((r) => FluNetRow.parse(r));
    const path = join(ctx.tmpDir, `flunet_${Date.now()}.json`);
    const w = await writeRawFile(path, JSON.stringify(env), 'application/json');
    return {
      url: env.urls[0] ?? FLUNET_BASE_URL, urls: env.urls, path, ext: 'json', sha256: w.sha256, bytes: w.bytes,
      content_type: 'application/json', license: FLUNET_LICENSE, data_as_of: dataAsOfFromRows(parsed), fetched_at,
      extra: { countries, rows: env.value.length },
    };
  },

  async normalize(raw: RawSnapshot, ctx: NormalizeContext): Promise<Observation[]> {
    const env = JSON.parse(await readFile(raw.path, 'utf8')) as FluNetEnvelope;
    ctx.countRowsIn(env.value.length);
    const geo: GeoEntry[] = [];
    const stats = newFluNetStats();
    const obs = normalizeFluNetRows(env.value, ctx.snapshotId, geo, stats);
    ctx.ensureGeo(geo);
    ctx.report.countries = geo.map((g) => g.code);
    Object.assign(ctx.report, { rows: stats.rows, duplicates: stats.duplicates, duplicate_samples: stats.duplicate_samples, origin_source_unknown: stats.origin_source_unknown, unknown_origins: stats.unknown_origins });
    if (stats.duplicates > 0) {
      ctx.addError(`${stats.duplicates} linha(s) duplicada(s) por (COUNTRY_CODE, ISO_YEAR, ISO_WEEK, ORIGIN_SOURCE), ex.: ${stats.duplicate_samples.slice(0, 3).join('; ')}`);
      ctx.log(`[flunet] ERRO: ${stats.duplicates} linha(s) duplicada(s) na origem — snapshot irá para quarentena`);
    }
    if (stats.origin_source_unknown > 0) {
      ctx.log(`[flunet] AVISO: ${stats.origin_source_unknown} linha(s) com ORIGIN_SOURCE desconhecido (${Object.entries(stats.unknown_origins).map(([k, v]) => `${k}: ${v}`).join(', ')}) — incluídas no total com flag origin_source_unknown`);
    }
    return obs;
  },
};
