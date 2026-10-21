import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getIndicator, isoWeek, weekPeriodId, type Observation } from '@h1n1/core';
import type { Connector, FetchContext, NormalizeContext, RawSnapshot } from '../types.js';
import { fetchJson, writeRawFile } from '../http.js';
import { addDays, makeObs, parseFlexibleDate } from '../util.js';

export const UKHSA_URL =
  'https://api.ukhsa-dashboard.data.gov.uk/themes/infectious_disease/sub_themes/respiratory/topics/Influenza/geography_types/Nation/geographies/England/metrics/influenza_testing_positivityByWeek?page_size=365';
export const UKHSA_LICENSE = 'Open Government Licence v3.0 (UKHSA data dashboard)';
export const INDICATOR_ID = 'ukhsa_influenza_testing_positivity';

export const UkhsaRow = z.object({
  geography: z.string(),
  metric: z.string(),
  stratum: z.string(),
  sex: z.string(),
  age: z.string(),
  date: z.string(),
  metric_value: z.number().nullable(),
  in_reporting_delay_period: z.boolean(),
});
interface Page { count: number; next: string | null; results: unknown[] }
export interface UkhsaEnvelope { urls: string[]; results: unknown[] }

/** '00-04' → '0-4', '05-14' → '5-14'; demais faixas mantidas como a API devolve. */
export function normalizeAge(age: string): string {
  const m = /^0?(\d+)-0?(\d+)$/.exec(age);
  return m ? `${Number(m[1])}-${Number(m[2])}` : age;
}

export interface UkhsaStats { rows: number; filtered: number; null_values: number; duplicates: number; age_skipped: Record<string, number> }

/**
 * Total = linhas age='all' & sex='all' (stratum {}); demais idades viram {age}. Só faixas previstas no
 * stratum_schema da ontologia são emitidas; as demais (hoje '65-79' e '80+', que não se somam em '65+'
 * por serem percentuais) são contadas em stats.age_skipped.
 */
export function normalizeUkhsa(results: unknown[], snapshotId: string, stats?: UkhsaStats): Observation[] {
  const out: Observation[] = [];
  const seen = new Set<string>();
  const allowedAges = getIndicator(INDICATOR_ID).stratum_schema.age ?? [];
  const st: UkhsaStats = stats ?? { rows: 0, filtered: 0, null_values: 0, duplicates: 0, age_skipped: {} };
  for (const raw of results) {
    const r = UkhsaRow.parse(raw);
    st.rows++;
    if (r.geography !== 'England' || r.metric !== 'influenza_testing_positivityByWeek' || r.stratum !== 'default' || r.sex !== 'all') { st.filtered++; continue; }
    const d = parseFlexibleDate(r.date);
    if (!d || r.metric_value === null) { st.null_values++; continue; }
    const { year, week } = isoWeek(d);
    const period = weekPeriodId(year, week);
    const age = normalizeAge(r.age);
    if (age !== 'all' && !allowedAges.includes(age)) { st.age_skipped[age] = (st.age_skipped[age] ?? 0) + 1; continue; }
    const stratum: Record<string, string> = age === 'all' ? {} : { age };
    const key = `${period}|${JSON.stringify(stratum)}`;
    if (seen.has(key)) { st.duplicates++; continue; }
    seen.add(key);
    out.push(makeObs({
      snapshot_id: snapshotId, indicator_id: INDICATOR_ID, geo_level: 'country', geo_code: 'ENG', period_type: 'isoweek', period,
      value: r.metric_value, stratum, update_status: r.in_reporting_delay_period ? 'provisional' : 'final',
    }));
  }
  return out;
}

export function dataAsOfFromResults(results: unknown[]): string | null {
  let max: string | null = null;
  for (const raw of results) {
    const p = UkhsaRow.safeParse(raw);
    if (!p.success) continue;
    const d = p.data.date.slice(0, 10);
    if (!max || d > max) max = d;
  }
  return max ? addDays(max, 6) : null;
}

export const ukhsaConnector: Connector = {
  id: 'ukhsa',
  sourceId: 'UK-01',
  indicators: [INDICATOR_ID],

  async fetch(ctx: FetchContext): Promise<RawSnapshot> {
    const fetched_at = new Date().toISOString();
    const env: UkhsaEnvelope = { urls: [], results: [] };
    let url: string | null = UKHSA_URL;
    while (url) {
      env.urls.push(url);
      const page: Page = await fetchJson<Page>(url);
      env.results.push(...page.results);
      url = page.next;
    }
    ctx.log(`[ukhsa] ${env.results.length} registro(s) em ${env.urls.length} página(s)`);
    const path = join(ctx.tmpDir, `ukhsa_${Date.now()}.json`);
    const w = await writeRawFile(path, JSON.stringify(env), 'application/json');
    return {
      url: UKHSA_URL, urls: env.urls, path, ext: 'json', sha256: w.sha256, bytes: w.bytes, content_type: 'application/json',
      license: UKHSA_LICENSE, data_as_of: dataAsOfFromResults(env.results), fetched_at,
    };
  },

  async normalize(raw: RawSnapshot, ctx: NormalizeContext): Promise<Observation[]> {
    const env = JSON.parse(await readFile(raw.path, 'utf8')) as UkhsaEnvelope;
    ctx.countRowsIn(env.results.length);
    const stats: UkhsaStats = { rows: 0, filtered: 0, null_values: 0, duplicates: 0, age_skipped: {} };
    const obs = normalizeUkhsa(env.results, ctx.snapshotId, stats);
    Object.assign(ctx.report, stats);
    const skipped = Object.entries(stats.age_skipped).map(([k, v]) => `${k}: ${v}`).join(', ');
    if (skipped) ctx.log(`[ukhsa] faixas etárias fora do stratum_schema da ontologia ignoradas (${skipped})`);
    return obs;
  },
};
