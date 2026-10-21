import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Observation } from '@h1n1/core';
import type { Connector, FetchContext, GeoEntry, NormalizeContext, RawSnapshot } from '../types.js';
import { fetchJson, writeRawFile } from '../http.js';
import { makeObs } from '../util.js';

export const WORLDBANK_URL = 'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&date=2000:2025';
export const WORLDBANK_COUNTRIES_URL = 'https://api.worldbank.org/v2/country?format=json&per_page=400';
export const WORLDBANK_LICENSE = 'CC-BY 4.0 (World Bank Open Data, https://datacatalog.worldbank.org/public-licenses)';
export const INDICATOR_ID = 'worldbank_population_total';

export const WbRow = z.object({
  country: z.object({ id: z.string(), value: z.string() }),
  countryiso3code: z.string(),
  date: z.string(),
  value: z.number().nullable(),
});
const WbCountry = z.object({ id: z.string(), iso2Code: z.string(), name: z.string(), region: z.object({ id: z.string() }) });

export interface WbEnvelope { population: unknown; countries: unknown }
const ISO3 = /^[A-Z]{3}$/;

/** Conjunto de ISO3 que são agregados (region.id === 'NA' na lista de países do Banco Mundial). */
export function aggregateCodes(countries: unknown): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(countries) || !Array.isArray(countries[1])) return set;
  for (const c of countries[1]) {
    const p = WbCountry.safeParse(c);
    if (p.success && p.data.region.id === 'NA') set.add(p.data.id);
  }
  return set;
}

export function normalizeWorldBank(population: unknown, snapshotId: string, aggregates: ReadonlySet<string> = new Set(), geo?: GeoEntry[]): Observation[] {
  const out: Observation[] = [];
  if (!Array.isArray(population) || !Array.isArray(population[1])) throw new Error('worldbank: resposta inesperada');
  const seenGeo = new Set<string>();
  for (const raw of population[1]) {
    const r = WbRow.parse(raw);
    const code = r.countryiso3code;
    if (!ISO3.test(code) || r.value === null || aggregates.has(code)) continue;
    if (geo && !seenGeo.has(code)) { seenGeo.add(code); geo.push({ code, level: 'country', name: r.country.value, parent_code: 'WLD', iso2: r.country.id.length === 2 ? r.country.id : null }); }
    out.push(makeObs({ snapshot_id: snapshotId, indicator_id: INDICATOR_ID, geo_level: 'country', geo_code: code, period_type: 'year', period: r.date, value: r.value, update_status: 'final' }));
  }
  return out;
}

export const worldbankConnector: Connector = {
  id: 'worldbank',
  sourceId: 'INT-11',
  indicators: [INDICATOR_ID],

  async fetch(ctx: FetchContext): Promise<RawSnapshot> {
    const fetched_at = new Date().toISOString();
    const population = await fetchJson<unknown[]>(WORLDBANK_URL);
    const header = (population as Array<Record<string, unknown>>)[0] ?? {};
    if (Number(header.pages ?? 1) > 1) throw new Error(`worldbank: resposta paginada (${header.pages} páginas); aumente per_page`);
    const countries = await fetchJson(WORLDBANK_COUNTRIES_URL);
    ctx.log(`[worldbank] ${header.total ?? '?'} linha(s), lastupdated ${header.lastupdated ?? '?'}`);
    const env: WbEnvelope = { population, countries };
    const path = join(ctx.tmpDir, `worldbank_${Date.now()}.json`);
    const w = await writeRawFile(path, JSON.stringify(env), 'application/json');
    const lastupdated = typeof header.lastupdated === 'string' ? header.lastupdated : null;
    return {
      url: WORLDBANK_URL, urls: [WORLDBANK_URL, WORLDBANK_COUNTRIES_URL], path, ext: 'json', sha256: w.sha256, bytes: w.bytes,
      content_type: 'application/json', license: WORLDBANK_LICENSE, data_as_of: lastupdated, fetched_at,
    };
  },

  async normalize(raw: RawSnapshot, ctx: NormalizeContext): Promise<Observation[]> {
    const env = JSON.parse(await readFile(raw.path, 'utf8')) as WbEnvelope;
    const rows = Array.isArray(env.population) && Array.isArray(env.population[1]) ? env.population[1].length : 0;
    ctx.countRowsIn(rows);
    const aggregates = aggregateCodes(env.countries);
    const geo: GeoEntry[] = [];
    const obs = normalizeWorldBank(env.population, ctx.snapshotId, aggregates, geo);
    ctx.ensureGeo(geo);
    ctx.report.countries = geo.length;
    ctx.report.aggregates_ignored = aggregates.size;
    return obs;
  },
};
