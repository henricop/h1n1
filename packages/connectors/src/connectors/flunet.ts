import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { COUNTRY_BY_ISO3, isoWeek, isoWeekStart, weekPeriodId, type Observation, type UpdateStatus } from '@h1n1/core';
import type { Connector, ConnectorOptions, FetchContext, GeoEntry, NormalizeContext, RawSnapshot } from '../types.js';
import { fetchJson } from '../http.js';
import { addDays, isoDate, makeObs, percent } from '../util.js';

export const FLUNET_BASE_URL = 'https://xmart-api-public.who.int/FLUMART/VIW_FNT';
export const FLUNET_LICENSE = 'WHO FluNet — verificar termos de uso (https://www.who.int/about/policies/publishing/data-policy)';
export const PAGE = 5000;
const PROVISIONAL_WEEKS = 4;
/** `--country ALL` (ou `--all`): ingere a view inteira, todos os países. */
export const ALL_COUNTRIES = 'ALL';
/** Primeiro ano com dados no FluNet; o modo ALL é particionado por ISO_YEAR (offsets rasos: $skip profundo estoura o timeout do xMart). */
export const FLUNET_FIRST_YEAR = 1995;
/** xMart é lento em páginas grandes: 3 min até os cabeçalhos, 10 min por página. */
export const FLUNET_PAGE_TIMEOUTS = { headerTimeoutMs: 180_000, totalTimeoutMs: 600_000 } as const;

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
  /** repetições com os mesmos valores nas colunas usadas: descartadas, só aviso */
  duplicates_identical: number;
  /** repetições com valores diferentes: integridade da origem comprometida → quarentena */
  duplicates_conflicting: number;
  conflict_samples: string[];
  /** linhas com ORIGIN_SOURCE fora de KNOWN_ORIGINS: entram no total (flag origin_source_unknown), sem estrato próprio */
  origin_source_unknown: number;
  unknown_origins: Record<string, number>;
  /** linhas com COUNTRY_CODE fora de /^[A-Z]{3}$/ (ex.: X09..X12, nações do Reino Unido): ignoradas */
  country_code_ignored: number;
  ignored_country_codes: Record<string, number>;
}
export const newFluNetStats = (): FluNetStats => ({
  rows: 0, duplicates: 0, duplicate_samples: [], duplicates_identical: 0, duplicates_conflicting: 0, conflict_samples: [],
  origin_source_unknown: 0, unknown_origins: {}, country_code_ignored: 0, ignored_country_codes: {},
});

/** Normaliza e valida a lista de `--country` (ISO3, três letras maiúsculas) antes de montar qualquer filtro OData. */
export function validateCountries(list: string[]): string[] {
  const out = list.map((c) => c.trim().toUpperCase());
  const bad = out.filter((c) => !COUNTRY_RE.test(c));
  if (bad.length) throw new Error(`flunet: código(s) de país inválido(s) em --country (esperado ISO3, ex.: BRA, ou ALL): ${bad.join(', ')}`);
  return [...new Set(out)];
}

/**
 * Seleção de países a partir das opções: `--all` ou `--country ALL` (sozinho ou na lista) = view inteira;
 * caso contrário lista ISO3 validada (default BRA).
 */
export function resolveCountrySelection(options: ConnectorOptions): { all: true } | { all: false; countries: string[] } {
  const list = (options.countries ?? []).map((c) => c.trim().toUpperCase());
  if (options.all || list.includes(ALL_COUNTRIES)) return { all: true };
  return { all: false, countries: validateCountries(list.length ? list : ['BRA']) };
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

/**
 * Modo ALL, partição por ano ISO: ordenação estável (ISOYW, COUNTRY_CODE, ORIGIN_SOURCE) para paginação por $top/$skip;
 * a primeira página pede `$count=true` para conferir o total da partição.
 */
export function flunetYearUrl(year: number, skip = 0): string {
  if (!Number.isInteger(year)) throw new Error(`flunet: ano inválido: ${year}`);
  const filter = encodeURIComponent(`ISO_YEAR eq ${year}`);
  return `${FLUNET_BASE_URL}?$filter=${filter}&$orderby=ISOYW,COUNTRY_CODE,ORIGIN_SOURCE&$top=${PAGE}&$skip=${skip}${skip === 0 ? '&$count=true' : ''}`;
}

/** Anos ISO do modo ALL: FLUNET_FIRST_YEAR até o ano ISO corrente + 1 (semanas de dezembro podem cair no ano seguinte). */
export function flunetAllYears(now = new Date()): number[] {
  const last = isoWeek(now).year + 1;
  return Array.from({ length: last - FLUNET_FIRST_YEAR + 1 }, (_, i) => FLUNET_FIRST_YEAR + i);
}

interface ODataPage { value: unknown[]; '@odata.nextLink'?: string; '@odata.count'?: number }

/**
 * Percorre as páginas OData: segue `@odata.nextLink` quando presente; senão avança `$skip` enquanto a página
 * vier cheia (>= PAGE linhas). Devolve cada página como lista de linhas brutas (e `@odata.count`, se vier).
 */
export async function* fetchPages(firstUrl: string, nextUrl: (skip: number) => string): AsyncGenerator<{ url: string; rows: unknown[]; count?: number }> {
  let url: string | null = firstUrl;
  let skip = 0;
  while (url) {
    const page: ODataPage = await fetchJson<ODataPage>(url, {}, FLUNET_PAGE_TIMEOUTS);
    const rows = Array.isArray(page.value) ? page.value : [];
    yield { url, rows, count: typeof page['@odata.count'] === 'number' ? page['@odata.count'] : undefined };
    skip += rows.length; // $skip = linhas já consumidas, inclusive as de páginas seguidas por nextLink
    if (page['@odata.nextLink']) url = page['@odata.nextLink'];
    else if (rows.length >= PAGE) url = nextUrl(skip);
    else url = null;
  }
}

/** Escritor NDJSON com sha256/bytes calculados no fluxo (o bruto nunca fica inteiro em memória). */
class NdjsonWriter {
  private readonly hash = createHash('sha256');
  private readonly stream: ReturnType<typeof createWriteStream>;
  bytes = 0;
  rows = 0;
  constructor(readonly path: string) { this.stream = createWriteStream(path); }
  async write(rows: unknown[]): Promise<void> {
    if (!rows.length) return;
    const chunk = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    const buf = Buffer.from(chunk, 'utf8');
    this.hash.update(buf);
    this.bytes += buf.length;
    this.rows += rows.length;
    if (!this.stream.write(buf)) await new Promise<void>((res) => this.stream.once('drain', () => res()));
  }
  async close(): Promise<string> {
    await new Promise<void>((res, rej) => this.stream.end((e?: Error | null) => (e ? rej(e) : res())));
    return this.hash.digest('hex');
  }
}

/** Lê um NDJSON linha a linha (streaming). */
export async function* readNdjson(path: string): AsyncGenerator<unknown> {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (t) yield JSON.parse(t);
  }
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

/** Mantém só as colunas usadas (a linha bruta tem ~60 campos; em modo ALL são 190 mil linhas em memória). */
function slim(r: FluNetRow): FluNetRow {
  return {
    COUNTRY_CODE: r.COUNTRY_CODE, COUNTRY_AREA_TERRITORY: r.COUNTRY_AREA_TERRITORY ?? null, ISO2: r.ISO2 ?? null,
    ISO_YEAR: r.ISO_YEAR, ISO_WEEK: r.ISO_WEEK, ISO_WEEKSTARTDATE: r.ISO_WEEKSTARTDATE.slice(0, 10), ORIGIN_SOURCE: r.ORIGIN_SOURCE,
    SPEC_PROCESSED_NB: r.SPEC_PROCESSED_NB ?? null, AH1N12009: r.AH1N12009 ?? null, AH3: r.AH3 ?? null, INF_A: r.INF_A ?? null,
    ANOTSUBTYPED: r.ANOTSUBTYPED ?? null, ANOTSUBTYPABLE: r.ANOTSUBTYPABLE ?? null, INF_B: r.INF_B ?? null, INF_ALL: r.INF_ALL ?? null,
  };
}

/** Duas linhas são idênticas quando coincidem em todas as colunas usadas na normalização. */
function sameValues(a: FluNetRow, b: FluNetRow): boolean {
  return a.ISO_WEEKSTARTDATE === b.ISO_WEEKSTARTDATE && COLS.every((c) => (a[c] ?? null) === (b[c] ?? null));
}

/**
 * Agrupador por país com as regras de linha: COUNTRY_CODE fora de /^[A-Z]{3}$/ é ignorado (contado em
 * stats.country_code_ignored); duplicatas por (COUNTRY_CODE, ISO_YEAR, ISO_WEEK, ORIGIN_SOURCE) só contam a primeira —
 * idênticas são só aviso, conflitantes (valores diferentes) derrubam a snapshot; ORIGIN_SOURCE desconhecido é contado
 * (entra no total, sem estrato).
 */
export class CountryGrouper {
  readonly byCountry = new Map<string, FluNetRow[]>();
  private readonly seen = new Map<string, FluNetRow>();
  constructor(readonly stats: FluNetStats) {}
  add(raw: unknown): void {
    const r = FluNetRow.parse(raw);
    const st = this.stats;
    st.rows++;
    const code = r.COUNTRY_CODE.trim().toUpperCase();
    if (!COUNTRY_RE.test(code)) {
      st.country_code_ignored++;
      st.ignored_country_codes[code] = (st.ignored_country_codes[code] ?? 0) + 1;
      return;
    }
    const key = `${code}|${r.ISO_YEAR}|${r.ISO_WEEK}|${r.ORIGIN_SOURCE}`;
    const row = slim(r);
    row.COUNTRY_CODE = code;
    const first = this.seen.get(key);
    if (first) {
      st.duplicates++;
      if (st.duplicate_samples.length < 5) st.duplicate_samples.push(key);
      if (sameValues(first, row)) st.duplicates_identical++;
      else {
        st.duplicates_conflicting++;
        if (st.conflict_samples.length < 5) st.conflict_samples.push(key);
      }
      return;
    }
    this.seen.set(key, row);
    if (!KNOWN_ORIGINS.has(r.ORIGIN_SOURCE)) {
      st.origin_source_unknown++;
      st.unknown_origins[r.ORIGIN_SOURCE] = (st.unknown_origins[r.ORIGIN_SOURCE] ?? 0) + 1;
    }
    const arr = this.byCountry.get(code);
    if (arr) arr.push(row); else this.byCountry.set(code, [row]);
  }
}

export function geoEntryFor(country: string, crows: FluNetRow[]): GeoEntry {
  const name = crows.find((r) => r.COUNTRY_AREA_TERRITORY)?.COUNTRY_AREA_TERRITORY ?? COUNTRY_BY_ISO3.get(country)?.name ?? country;
  return { code: country, level: 'country', name, parent_code: 'WLD', iso2: crows.find((r) => r.ISO2)?.ISO2 ?? null };
}

/**
 * Observações de um país (sem supressão: isso é da camada de publicação). Total da semana = soma das origens
 * (null = ausente, nunca zero) + estratos origin_source conhecidos; `provisional` nas 4 últimas semanas do país.
 */
export function countryObservations(country: string, crows: FluNetRow[], snapshotId: string): Observation[] {
  const out: Observation[] = [];
  if (!crows.length) return out;
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
  return out;
}

/**
 * Normalização em streaming: agrupa as linhas por país e emite um lote de observações por país, chamando
 * `onCountry` (ensureGeo) antes de cada lote. Só as linhas (enxutas) ficam em memória, nunca as ~3 M observações.
 */
export async function* normalizeFluNetStream(
  rawRows: AsyncIterable<unknown> | Iterable<unknown>, snapshotId: string, stats: FluNetStats, onCountry?: (geo: GeoEntry) => void,
): AsyncGenerator<Observation[]> {
  const g = new CountryGrouper(stats);
  for await (const raw of rawRows) g.add(raw);
  const byCountry = g.byCountry;
  for (const country of [...byCountry.keys()].sort()) {
    const crows = byCountry.get(country)!;
    onCountry?.(geoEntryFor(country, crows));
    yield countryObservations(country, crows, snapshotId);
    byCountry.delete(country);
  }
}

/**
 * Versão síncrona (listas pequenas / testes): mesmas regras de `normalizeFluNetStream`, devolvendo todas as
 * observações e preenchendo `geo` com um GeoEntry por país.
 */
export function normalizeFluNetRows(rawRows: unknown[], snapshotId: string, geo?: GeoEntry[], stats?: FluNetStats): Observation[] {
  const g = new CountryGrouper(stats ?? newFluNetStats());
  for (const raw of rawRows) g.add(raw);
  const out: Observation[] = [];
  for (const [country, crows] of g.byCountry) {
    geo?.push(geoEntryFor(country, crows));
    out.push(...countryObservations(country, crows, snapshotId));
  }
  return out;
}

export interface FluNetFetchSummary {
  urls: string[];
  rows: number;
  pages: number;
  data_as_of: string | null;
  countries_seen: number;
  /** partições cujo `@odata.count` difere das linhas recebidas (integridade da paginação) */
  count_mismatches: Array<{ label: string; expected: number; received: number }>;
  /** linhas por partição (país ou ano) */
  partitions: Record<string, number>;
}

export interface FluNetSource { first: string; next: (skip: number) => string; label: string }

/**
 * Baixa as páginas e grava o bruto como NDJSON (uma linha FluNet por linha de arquivo, exatamente como recebida).
 * `data_as_of` = maior ISO_WEEKSTARTDATE + 6 dias, calculado no fluxo. Em erro o arquivo parcial é removido.
 */
export async function fetchToNdjson(path: string, sources: FluNetSource[], log: (m: string) => void): Promise<FluNetFetchSummary & { sha256: string; bytes: number }> {
  await mkdir(join(path, '..'), { recursive: true });
  const w = new NdjsonWriter(path);
  const urls: string[] = [];
  let pages = 0;
  let maxDate: string | null = null;
  const countries = new Set<string>();
  const count_mismatches: FluNetFetchSummary['count_mismatches'] = [];
  const partitions: Record<string, number> = {};
  try {
    for (const src of sources) {
      let n = 0;
      let reqs = 0;
      let expected: number | undefined;
      for await (const page of fetchPages(src.first, src.next)) {
        urls.push(page.url);
        pages++;
        reqs++;
        if (reqs === 1 && page.count !== undefined) expected = page.count;
        for (const raw of page.rows) {
          const r = raw as { ISO_WEEKSTARTDATE?: unknown; COUNTRY_CODE?: unknown };
          const d = typeof r.ISO_WEEKSTARTDATE === 'string' ? r.ISO_WEEKSTARTDATE.slice(0, 10) : null;
          if (d && (!maxDate || d > maxDate)) maxDate = d;
          if (typeof r.COUNTRY_CODE === 'string') countries.add(r.COUNTRY_CODE);
        }
        await w.write(page.rows);
        n += page.rows.length;
      }
      partitions[src.label] = n;
      if (expected !== undefined && expected !== n) count_mismatches.push({ label: src.label, expected, received: n });
      const isYear = src.label.startsWith(`${ALL_COUNTRIES}:`);
      log(`[flunet] ${src.label}: ${n} linha(s) em ${reqs} requisição(ões)${expected !== undefined ? ` ($count=${expected}${expected !== n ? ' — DIVERGENTE' : ''})` : ''}${isYear ? `, acumulado ${w.rows}` : ''}${n === 0 && !isYear ? ' — AVISO: nenhum dado (o FluNet pode usar outro código, ex.: Reino Unido é reportado por nação: X09–X12)' : ''}`);
    }
  } catch (e) {
    await w.close().catch(() => {});
    await rm(path, { force: true }).catch(() => {});
    throw e;
  }
  const sha256 = await w.close();
  return { urls, rows: w.rows, pages, data_as_of: maxDate ? addDays(maxDate, 6) : null, countries_seen: countries.size, count_mismatches, partitions, sha256, bytes: w.bytes };
}

export const flunetConnector: Connector = {
  id: 'flunet',
  sourceId: 'INT-01',
  indicators: FLUNET_INDICATORS,

  async fetch(ctx: FetchContext): Promise<RawSnapshot> {
    const sel = resolveCountrySelection(ctx.options);
    const fetched_at = new Date().toISOString();
    const path = join(ctx.tmpDir, `flunet_${Date.now()}.ndjson`);
    const years = sel.all ? flunetAllYears() : [];
    const sources: FluNetSource[] = sel.all
      ? years.map((y) => ({ first: flunetYearUrl(y, 0), next: (skip: number) => flunetYearUrl(y, skip), label: `${ALL_COUNTRIES}:${y}` }))
      : sel.countries.map((c) => ({ first: flunetUrl(c, 0), next: (skip: number) => flunetUrl(c, skip), label: c }));
    if (sel.all) ctx.log(`[flunet] modo ALL: ingerindo a view VIW_FNT inteira, particionada por ISO_YEAR ${years[0]}..${years[years.length - 1]} (páginas de ${PAGE}, $orderby=ISOYW,COUNTRY_CODE,ORIGIN_SOURCE)`);
    const s = await fetchToNdjson(path, sources, ctx.log);
    if (s.count_mismatches.length) ctx.log(`[flunet] AVISO: ${s.count_mismatches.length} partição(ões) com $count divergente das linhas recebidas: ${s.count_mismatches.map((m) => `${m.label} ${m.received}/${m.expected}`).join(', ')} — a snapshot irá para quarentena`);
    return {
      url: s.urls[0] ?? FLUNET_BASE_URL, urls: s.urls, path, ext: 'ndjson', sha256: s.sha256, bytes: s.bytes,
      content_type: 'application/x-ndjson', license: FLUNET_LICENSE, data_as_of: s.data_as_of, fetched_at,
      extra: {
        mode: sel.all ? 'all' : 'countries', countries: sel.all ? [ALL_COUNTRIES] : sel.countries, years: sel.all ? years : undefined,
        rows: s.rows, pages: s.pages, countries_seen: s.countries_seen, partitions: s.partitions, count_mismatches: s.count_mismatches, format: 'ndjson',
      },
    };
  },

  async *normalize(raw: RawSnapshot, ctx: NormalizeContext): AsyncIterable<Observation[]> {
    const stats = newFluNetStats();
    const countries: string[] = [];
    const withoutCentroid: string[] = [];
    let rowsCounted = 0;
    const counting = (async function* () {
      for await (const row of readNdjson(raw.path)) { rowsCounted++; yield row; }
    })();
    for await (const batch of normalizeFluNetStream(counting, ctx.snapshotId, stats, (g) => {
      ctx.ensureGeo([g]);
      countries.push(g.code);
      if (!COUNTRY_BY_ISO3.has(g.code)) withoutCentroid.push(g.code);
    })) {
      yield batch;
    }
    ctx.countRowsIn(rowsCounted);
    const mismatches = (raw.extra?.count_mismatches as FluNetFetchSummary['count_mismatches'] | undefined) ?? [];
    Object.assign(ctx.report, {
      mode: raw.extra?.mode ?? 'countries', countries, countries_count: countries.length, countries_without_centroid: withoutCentroid,
      partitions: raw.extra?.partitions ?? null, count_mismatches: mismatches,
      rows: stats.rows, duplicates: stats.duplicates, duplicate_samples: stats.duplicate_samples,
      duplicates_identical: stats.duplicates_identical, duplicates_conflicting: stats.duplicates_conflicting, conflict_samples: stats.conflict_samples,
      origin_source_unknown: stats.origin_source_unknown, unknown_origins: stats.unknown_origins,
      country_code_ignored: stats.country_code_ignored, ignored_country_codes: stats.ignored_country_codes,
    });
    if (mismatches.length) {
      ctx.addError(`${mismatches.length} partição(ões) com $count divergente das linhas recebidas na paginação: ${mismatches.slice(0, 3).map((m) => `${m.label} ${m.received}/${m.expected}`).join('; ')}`);
    }
    if (stats.duplicates_conflicting > 0) {
      ctx.addError(`${stats.duplicates_conflicting} linha(s) duplicada(s) com valores conflitantes por (COUNTRY_CODE, ISO_YEAR, ISO_WEEK, ORIGIN_SOURCE), ex.: ${stats.conflict_samples.slice(0, 3).join('; ')}`);
      ctx.log(`[flunet] ERRO: ${stats.duplicates_conflicting} linha(s) duplicada(s) conflitante(s) na origem — snapshot irá para quarentena`);
    }
    if (stats.duplicates_identical > 0) {
      ctx.log(`[flunet] AVISO: ${stats.duplicates_identical} linha(s) repetida(s) idêntica(s) na origem descartada(s) (só a primeira conta), ex.: ${stats.duplicate_samples.slice(0, 3).join('; ')}`);
    }
    if (stats.origin_source_unknown > 0) {
      ctx.log(`[flunet] AVISO: ${stats.origin_source_unknown} linha(s) com ORIGIN_SOURCE desconhecido (${Object.entries(stats.unknown_origins).map(([k, v]) => `${k}: ${v}`).join(', ')}) — incluídas no total com flag origin_source_unknown`);
    }
    if (stats.country_code_ignored > 0) {
      ctx.log(`[flunet] AVISO: ${stats.country_code_ignored} linha(s) com COUNTRY_CODE fora de ISO3 ignorada(s) (${Object.entries(stats.ignored_country_codes).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
    }
    ctx.log(`[flunet] ${countries.length} país(es) com dados${withoutCentroid.length ? `; ${withoutCentroid.length} sem centróide em COUNTRY_CENTROIDS: ${withoutCentroid.join(', ')}` : ''}`);
  },
};
