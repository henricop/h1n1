/**
 * Cliente HTTP tipado da API do H1N1 (/v1). O site NÃO acessa o banco: consome a API.
 * - `next: { revalidate: 3600 }` e timeout de 8 s em toda chamada.
 * - Falhas nunca lançam: devolvem { ok: false, status: 'unavailable', attemptedAt }.
 * - Toda resposta passa por um schema zod mínimo; contrato inválido → 'unavailable' com motivo logado.
 * - Toda observação é normalizada: célula suprimida nunca carrega valor (`value = suppressed ? null : value`).
 * - Modo mock (H1N1_API_MOCK=1) lê fixtures em test/fixtures/api/*.json (mesma validação e normalização).
 */
import type { GeoLevel, IndicatorDefinition, Snapshot } from '@h1n1/core';
import { z } from 'zod';
import { SITE } from './site';

// ---------- Tipos (espelham packages/db/src/queries.ts) ----------
export interface SourceRow {
  id: string; slug: string; name: string; agency: string; country: string; region: string; category: string;
  access: string; access_type: string; h1n1_scope: string; update_cadence: string; priority: string; url: string;
  notes: string; license: string; mirror_group: string | null; api_tested_at: string | null;
}

export interface IndicatorRow extends Omit<IndicatorDefinition, 'geo_levels' | 'caveats'> {
  geo_levels: string[];
  caveats: string[];
}

export interface PublicationRow {
  indicator_id: string; snapshot_id: string; published_at: string; data_as_of: string | null; status: string;
  validation_report: Record<string, unknown>;
}

export interface SeriesObservation {
  geo_level: GeoLevel;
  geo_code: string;
  period: string;
  period_start: string;
  period_end: string;
  value: number | null;
  denominator: number | null;
  stratum: Record<string, string>;
  suppressed: boolean;
  update_status: 'provisional' | 'final';
  quality_flags: string[];
}

export interface SeriesResult {
  indicator: IndicatorRow;
  source: SourceRow;
  publication: PublicationRow | null;
  snapshot: Snapshot | null;
  observations: SeriesObservation[];
  meta: {
    data_as_of: string | null;
    fetched_at: string | null;
    universe_note: string;
    case_definition: string;
    license: string | null;
    suppression_threshold: number;
    caveats: string[];
    count: number;
  };
}

export interface FreshnessRow {
  indicator_id: string;
  source_id: string;
  snapshot_id: string | null;
  data_as_of: string | null;
  fetched_at: string | null;
  published_at: string | null;
  age_days: number | null;
  last_run_status: string | null;
  last_run_finished_at: string | null;
}

export interface GeoRow {
  code: string; level: string; name: string; parent_code: string | null; ibge_id: string | null; iso2: string | null;
}

export type ApiResult<T> =
  | { ok: true; data: T; fetchedAt: string }
  | { ok: false; status: 'unavailable' | 'not_found'; error: string; attemptedAt: string };

export interface SeriesParams {
  indicator: string;
  geo_level?: GeoLevel;
  geo_code?: string;
  from?: string;
  to?: string;
  include_strata?: boolean;
  stratum?: Record<string, string>;
}

export const API_TIMEOUT_MS = 8_000;
/**
 * Revalidação (segundos) do cache de fetch da API e das páginas de dados.
 * As páginas exportam `revalidate = 3600` literalmente (exigência do Next: valor estaticamente analisável);
 * o teste `test/cache-policy.test.ts` garante que o literal coincide com esta constante.
 */
export const API_REVALIDATE_SECONDS = 3_600;
/** Idade (dias) a partir da qual um dado é exibido com selo "Dado defasado" (age_days > 14). */
export const STALE_AFTER_DAYS = 14;

export function isMockMode(): boolean {
  return process.env.H1N1_API_MOCK === '1';
}

function unavailable<T>(error: string, status: 'unavailable' | 'not_found' = 'unavailable'): ApiResult<T> {
  return { ok: false, status, error, attemptedAt: new Date().toISOString() };
}

// ---------- Schemas mínimos do contrato da API (campos que o site de fato usa) ----------
const nullableString = z.string().nullable();

const SourceRowSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string(),
    agency: z.string(),
    region: z.string(),
    category: z.string(),
    access: z.string(),
    access_type: z.string(),
    h1n1_scope: z.string(),
    update_cadence: z.string(),
    priority: z.string(),
    url: z.string(),
    notes: z.string(),
    license: z.string(),
    mirror_group: nullableString,
    api_tested_at: nullableString,
  })
  .passthrough();

const IndicatorRowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string(),
    source_id: z.string(),
    case_definition: z.string(),
    unit: z.string(),
    universe_note: z.string(),
    methodology_version: z.string(),
    geo_levels: z.array(z.string()),
    period_type: z.string(),
    event_date_basis: z.string(),
    suppression_threshold: z.number(),
    caveats: z.array(z.string()),
  })
  .passthrough();

const SeriesObservationSchema = z
  .object({
    geo_level: z.string(),
    geo_code: z.string(),
    period: z.string(),
    period_start: z.string(),
    period_end: z.string(),
    value: z.number().nullable(),
    denominator: z.number().nullable().optional(),
    stratum: z.record(z.string()).default({}),
    suppressed: z.boolean().default(false),
    update_status: z.enum(['provisional', 'final']),
    quality_flags: z.array(z.string()).default([]),
  })
  .passthrough();

const SeriesResultSchema = z
  .object({
    indicator: IndicatorRowSchema,
    source: SourceRowSchema,
    publication: z.object({}).passthrough().nullable().optional(),
    snapshot: z.object({ id: z.string(), url: z.string(), sha256: z.string() }).passthrough().nullable().optional(),
    observations: z.array(SeriesObservationSchema),
    meta: z
      .object({
        data_as_of: nullableString,
        fetched_at: nullableString,
        universe_note: z.string(),
        case_definition: z.string(),
        license: nullableString,
        suppression_threshold: z.number(),
        caveats: z.array(z.string()),
        count: z.number(),
      })
      .passthrough(),
  })
  .passthrough();

const FreshnessRowSchema = z
  .object({
    indicator_id: z.string().min(1),
    source_id: z.string(),
    data_as_of: nullableString,
    fetched_at: nullableString,
    age_days: z.number().nullable(),
  })
  .passthrough();

const GeoRowSchema = z.object({ code: z.string().min(1), level: z.string(), name: z.string() }).passthrough();

const SourcesSchema = z.object({ data: z.array(SourceRowSchema) }).passthrough();
const SourceDetailSchema = z.object({ data: SourceRowSchema, indicators: z.array(IndicatorRowSchema).optional() }).passthrough();
const IndicatorsSchema = z.object({ data: z.array(IndicatorRowSchema) }).passthrough();
const IndicatorDetailSchema = z.object({ data: IndicatorRowSchema }).passthrough();
const FreshnessSchema = z.object({ data: z.array(FreshnessRowSchema) }).passthrough();
const GeoSchema = z.object({ data: z.array(GeoRowSchema) }).passthrough();

/**
 * Valida o JSON contra o schema mínimo. Os tipos exportados (interfaces) continuam sendo a fonte de verdade
 * para o TypeScript; o schema só garante a forma mínima do contrato em tempo de execução.
 */
function validate<T>(schema: z.ZodTypeAny, json: unknown, where: string): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data as T };
  const issues = parsed.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
    .join('; ');
  const error = `Contrato inválido da API em ${where}: ${issues}`;
  console.error(`[api] ${error}`);
  return { ok: false, error };
}

/** Célula suprimida nunca carrega valor, independentemente do que a API devolveu. */
export function normalizeObservation(o: SeriesObservation): SeriesObservation {
  return o.suppressed ? { ...o, value: null } : o;
}

function normalizeSeries(r: SeriesResult): SeriesResult {
  return { ...r, observations: r.observations.map(normalizeObservation) };
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

function seriesQuery(p: SeriesParams): Record<string, string | boolean | undefined> {
  const q: Record<string, string | boolean | undefined> = {
    indicator: p.indicator,
    geo_level: p.geo_level,
    geo_code: p.geo_code,
    from: p.from,
    to: p.to,
    include_strata: p.include_strata ? 'true' : undefined,
  };
  for (const [k, v] of Object.entries(p.stratum ?? {})) q[`stratum.${k}`] = v;
  return q;
}

/** URL pública do CSV (botão "Baixar CSV"). */
export function seriesCsvUrl(p: SeriesParams): string {
  return `${SITE.apiUrl}/v1/series.csv${buildQuery(seriesQuery(p))}`;
}

async function request<T>(path: string, schema: z.ZodTypeAny): Promise<ApiResult<T>> {
  const url = `${SITE.apiUrl}${path}`;
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      next: { revalidate: API_REVALIDATE_SECONDS },
    });
    if (res.status === 404) return unavailable<T>(`Recurso não encontrado: ${path}`, 'not_found');
    if (!res.ok) return unavailable<T>(`API respondeu ${res.status} em ${path}`);
    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const error = `Contrato inválido da API em ${path}: corpo não é JSON (${msg})`;
      console.error(`[api] ${error}`);
      return unavailable<T>(error);
    }
    const v = validate<T>(schema, json, path);
    if (!v.ok) return unavailable<T>(v.error);
    return { ok: true, data: v.data, fetchedAt: new Date().toISOString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return unavailable<T>(`Falha ao acessar ${url}: ${msg}`);
  }
}

// ---------- Mock (fixtures) ----------
async function readFixture<T>(name: string, schema: z.ZodTypeAny): Promise<T | null> {
  const [{ readFile }, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
  const dir = process.env.H1N1_FIXTURES_DIR ?? path.join(process.cwd(), 'test', 'fixtures', 'api');
  let raw: string;
  try {
    raw = await readFile(path.join(dir, `${name}.json`), 'utf8');
  } catch {
    return null;
  }
  const v = validate<T>(schema, JSON.parse(raw), `fixture ${name}.json`);
  return v.ok ? v.data : null;
}

async function mock<T>(name: string, schema: z.ZodTypeAny, transform?: (d: T) => T | null): Promise<ApiResult<T>> {
  const data = await readFixture<T>(name, schema);
  if (data === null) return unavailable<T>(`Fixture ausente ou inválida: ${name}.json`, 'not_found');
  const out = transform ? transform(data) : data;
  if (out === null) return unavailable<T>(`Sem resultado para ${name}`, 'not_found');
  return { ok: true, data: out, fetchedAt: new Date().toISOString() };
}

// ---------- Endpoints ----------
export async function getSources(filter: { priority?: string; access_type?: string } = {}): Promise<ApiResult<{ data: SourceRow[] }>> {
  if (isMockMode()) {
    return mock<{ data: SourceRow[] }>('sources', SourcesSchema, (d) => ({
      data: d.data.filter(
        (s) => (!filter.priority || s.priority === filter.priority) && (!filter.access_type || s.access_type === filter.access_type),
      ),
    }));
  }
  return request<{ data: SourceRow[] }>(`/v1/sources${buildQuery({ priority: filter.priority, access_type: filter.access_type })}`, SourcesSchema);
}

/** Item de fonte; a API inclui os indicadores derivados (`indicators`). */
export async function getSource(idOrSlug: string): Promise<ApiResult<{ data: SourceRow; indicators?: IndicatorRow[] }>> {
  if (isMockMode()) {
    const [all, ind] = await Promise.all([
      readFixture<{ data: SourceRow[] }>('sources', SourcesSchema),
      readFixture<{ data: IndicatorRow[] }>('indicators', IndicatorsSchema),
    ]);
    const s = all?.data.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
    if (!s) return unavailable(`Fonte não encontrada: ${idOrSlug}`, 'not_found');
    return { ok: true, data: { data: s, indicators: ind?.data.filter((i) => i.source_id === s.id) ?? [] }, fetchedAt: new Date().toISOString() };
  }
  return request<{ data: SourceRow; indicators?: IndicatorRow[] }>(`/v1/sources/${encodeURIComponent(idOrSlug)}`, SourceDetailSchema);
}

export async function getIndicators(): Promise<ApiResult<{ data: IndicatorRow[] }>> {
  if (isMockMode()) return mock<{ data: IndicatorRow[] }>('indicators', IndicatorsSchema);
  return request<{ data: IndicatorRow[] }>('/v1/indicators', IndicatorsSchema);
}

export async function getIndicator(id: string): Promise<ApiResult<{ data: IndicatorRow }>> {
  if (isMockMode()) {
    const all = await readFixture<{ data: IndicatorRow[] }>('indicators', IndicatorsSchema);
    const i = all?.data.find((x) => x.id === id);
    return i ? { ok: true, data: { data: i }, fetchedAt: new Date().toISOString() } : unavailable(`Indicador não encontrado: ${id}`, 'not_found');
  }
  return request<{ data: IndicatorRow }>(`/v1/indicators/${encodeURIComponent(id)}`, IndicatorDetailSchema);
}

export async function getSeries(p: SeriesParams): Promise<ApiResult<SeriesResult>> {
  if (!/^[a-z0-9_]+$/.test(p.indicator)) return unavailable('Identificador de indicador inválido', 'not_found');
  if (isMockMode()) {
    return mock<SeriesResult>(`series.${p.indicator}`, SeriesResultSchema, (d) => {
      const stratumKeys = Object.keys(p.stratum ?? {});
      const obs = d.observations.filter((o) => {
        if (p.geo_level && o.geo_level !== p.geo_level) return false;
        if (p.geo_code && o.geo_code !== p.geo_code) return false;
        if (p.from && o.period < p.from) return false;
        if (p.to && o.period > p.to) return false;
        if (stratumKeys.length) return stratumKeys.every((k) => o.stratum[k] === p.stratum![k]);
        if (!p.include_strata) return Object.keys(o.stratum).length === 0;
        return true;
      });
      return normalizeSeries({ ...d, observations: obs, meta: { ...d.meta, count: obs.length } });
    });
  }
  const r = await request<SeriesResult>(`/v1/series${buildQuery(seriesQuery(p))}`, SeriesResultSchema);
  return r.ok ? { ...r, data: normalizeSeries(r.data) } : r;
}

export async function getFreshness(): Promise<ApiResult<{ data: FreshnessRow[] }>> {
  if (isMockMode()) return mock<{ data: FreshnessRow[] }>('freshness', FreshnessSchema);
  return request<{ data: FreshnessRow[] }>('/v1/freshness', FreshnessSchema);
}

export async function getGeo(level?: string): Promise<ApiResult<{ data: GeoRow[] }>> {
  if (isMockMode()) return mock<{ data: GeoRow[] }>('geo', GeoSchema, (d) => ({ data: level ? d.data.filter((g) => g.level === level) : d.data }));
  return request<{ data: GeoRow[] }>(`/v1/geo${buildQuery({ level })}`, GeoSchema);
}

// ---------- Frescor ----------

/** Linha de frescor de um indicador (null se a API falhou ou o indicador não consta). */
export function freshnessFor(fresh: ApiResult<{ data: FreshnessRow[] }>, indicatorId: string): FreshnessRow | null {
  if (!fresh.ok) return null;
  return fresh.data.data.find((f) => f.indicator_id === indicatorId) ?? null;
}

/** Defasado quando age_days > STALE_AFTER_DAYS (14 dias não é defasado; 15 é). */
export function isStale(row: FreshnessRow | null): boolean {
  return row?.age_days !== null && row?.age_days !== undefined && row.age_days > STALE_AFTER_DAYS;
}

/**
 * Estado de frescor de um indicador para exibição:
 * - `verified: false` quando /v1/freshness falhou (a página mostra "frescor não verificado", nunca esconde o selo em silêncio);
 * - `stale` só pode ser true quando verificado.
 */
export interface FreshnessState {
  verified: boolean;
  row: FreshnessRow | null;
  stale: boolean;
  /** Motivo da falha de /v1/freshness (quando `verified` é false). */
  error?: string;
}

export function freshnessState(fresh: ApiResult<{ data: FreshnessRow[] }>, indicatorId: string): FreshnessState {
  if (!fresh.ok) return { verified: false, row: null, stale: false, error: fresh.error };
  const row = freshnessFor(fresh, indicatorId);
  return { verified: true, row, stale: isStale(row) };
}

// =====================================================================================================
// Sala de situação: endpoints novos (/v1/globe, /v1/map/brazil, /v1/analytics/*, /v1/runs, /latest)
// Mesmas regras: zod mínimo, timeout, nunca lança, 'unavailable' honesto; mock lê fixtures por nome.
// =====================================================================================================

export interface PanelMeta {
  data_as_of: string | null;
  universe_note: string;
  license: string | null;
  source_id: string;
  case_definition: string;
}
export interface IndicatorRef { id: string; name: string }

export interface GlobeCountry { iso3: string; name: string; lat: number; lon: number; who_region: string | null; values: (number | null)[] }
export interface GlobeResult { indicator: IndicatorRef; meta: PanelMeta; weeks: string[]; countries: GlobeCountry[] }

export interface MapState { code: string; uf: string; name: string; ibge: string; values: (number | null)[]; suppressed: boolean[] }
export interface BrazilMapResult { indicator: IndicatorRef; meta: PanelMeta; weeks: string[]; states: MapState[]; national: { values: (number | null)[]; provisional: boolean[] } }

export interface EarsRow { geo_code: string; name: string; period: string; value: number | null; provisional: boolean; c1: number | null; c2: number | null; c3: number | null; flags: string[] }
export interface EarsResult { indicator: IndicatorRef; meta: PanelMeta; method: { name: string; baseline: string; guard: string; thresholds: string; note: string }; results: EarsRow[] }

export interface NowcastRow { period: string; weeks_ago: number; observed: number | null; reported_share: number; estimated: number; lower: number; upper: number }
export interface NowcastResult { indicator: IndicatorRef; meta: PanelMeta; delay: { period: string; n: number; cdf: number[] }; results: NowcastRow[]; note: string }

export interface SeasonsResult { indicator: IndicatorRef; meta: PanelMeta; weeks: number[]; seasons: Array<{ year: number; values: (number | null)[] }> }

export interface RunRow { id: string; connector: string; source_id: string; started_at: string; finished_at: string | null; status: string; rows_in: number | null; rows_out: number | null; error: string | null }
export interface RunsResult { data: RunRow[] }

export interface LatestResult { indicator: IndicatorRef; geo_code: string; period: string; period_end: string; value: number | null; suppressed: boolean; provisional: boolean; trend_pct_vs_4w: number | null; data_as_of: string | null }

const IndicatorRefSchema = z.object({ id: z.string().min(1), name: z.string() }).passthrough();
const PanelMetaSchema = z
  .object({ data_as_of: nullableString, universe_note: z.string(), license: nullableString, source_id: z.string(), case_definition: z.string() })
  .passthrough();
const NullableNumbers = z.array(z.number().nullable());

const GlobeSchema = z
  .object({
    indicator: IndicatorRefSchema,
    meta: PanelMetaSchema,
    weeks: z.array(z.string().regex(/^\d{4}-W\d{2}$/)),
    countries: z.array(z.object({ iso3: z.string().length(3), name: z.string(), lat: z.number(), lon: z.number(), who_region: nullableString, values: NullableNumbers }).passthrough()),
  })
  .passthrough();

const BrazilMapSchema = z
  .object({
    indicator: IndicatorRefSchema,
    meta: PanelMetaSchema,
    weeks: z.array(z.string()),
    states: z.array(z.object({ code: z.string(), uf: z.string().length(2), name: z.string(), ibge: z.string(), values: NullableNumbers, suppressed: z.array(z.boolean()) }).passthrough()),
    national: z.object({ values: NullableNumbers, provisional: z.array(z.boolean()) }).passthrough(),
  })
  .passthrough();

const EarsSchema = z
  .object({
    indicator: IndicatorRefSchema,
    meta: PanelMetaSchema,
    method: z.object({ name: z.string(), baseline: z.string(), guard: z.string(), thresholds: z.string(), note: z.string() }).passthrough(),
    results: z.array(
      z
        .object({ geo_code: z.string(), name: z.string(), period: z.string(), value: z.number().nullable(), provisional: z.boolean(), c1: z.number().nullable(), c2: z.number().nullable(), c3: z.number().nullable(), flags: z.array(z.string()).default([]) })
        .passthrough(),
    ),
  })
  .passthrough();

const NowcastSchema = z
  .object({
    indicator: IndicatorRefSchema,
    meta: PanelMetaSchema,
    delay: z.object({ period: z.string(), n: z.number(), cdf: z.array(z.number()) }).passthrough(),
    results: z.array(z.object({ period: z.string(), weeks_ago: z.number(), observed: z.number().nullable(), reported_share: z.number(), estimated: z.number(), lower: z.number(), upper: z.number() }).passthrough()),
    note: z.string(),
  })
  .passthrough();

const SeasonsSchema = z
  .object({ indicator: IndicatorRefSchema, meta: PanelMetaSchema, weeks: z.array(z.number()), seasons: z.array(z.object({ year: z.number(), values: NullableNumbers }).passthrough()) })
  .passthrough();

const RunsSchema = z
  .object({
    data: z.array(
      z
        .object({ id: z.string(), connector: z.string(), source_id: z.string(), started_at: z.string(), finished_at: nullableString, status: z.string(), rows_in: z.number().nullable(), rows_out: z.number().nullable(), error: nullableString })
        .passthrough(),
    ),
  })
  .passthrough();

const LatestSchema = z
  .object({ indicator: IndicatorRefSchema, geo_code: z.string(), period: z.string(), period_end: z.string(), value: z.number().nullable(), suppressed: z.boolean(), provisional: z.boolean(), trend_pct_vs_4w: z.number().nullable(), data_as_of: nullableString })
  .passthrough();

const SAFE_ID = /^[a-z0-9_]+$/;
const SAFE_GEO = /^[A-Z]{2,3}(-[A-Z]{2})?$/;

/** Célula suprimida do mapa nunca carrega valor, independentemente do que a API devolveu. */
export function normalizeMapState(s: MapState): MapState {
  return { ...s, values: s.values.map((v, i) => (s.suppressed[i] ? null : v)) };
}

/** Detecções por país e semana ISO para o globo (FluNet). `from` = primeira semana (ex.: 2009-W01). */
export async function getGlobe(p: { indicator: string; from?: string }): Promise<ApiResult<GlobeResult>> {
  if (!SAFE_ID.test(p.indicator)) return unavailable('Identificador de indicador inválido', 'not_found');
  if (isMockMode()) {
    return mock<GlobeResult>(`globe.${p.indicator}`, GlobeSchema, (d) => {
      const start = p.from ? d.weeks.findIndex((w) => w >= p.from!) : 0;
      if (start <= 0) return d;
      return { ...d, weeks: d.weeks.slice(start), countries: d.countries.map((c) => ({ ...c, values: c.values.slice(start) })) };
    });
  }
  return request<GlobeResult>(`/v1/globe${buildQuery({ indicator: p.indicator, from: p.from })}`, GlobeSchema);
}

/** Valores por UF e semana para o mapa do Brasil (SIVEP). Células suprimidas são normalizadas para null. */
export async function getBrazilMap(p: { indicator: string; from?: string; to?: string }): Promise<ApiResult<BrazilMapResult>> {
  if (!SAFE_ID.test(p.indicator)) return unavailable('Identificador de indicador inválido', 'not_found');
  const norm = (d: BrazilMapResult): BrazilMapResult => ({ ...d, states: d.states.map(normalizeMapState) });
  if (isMockMode()) {
    return mock<BrazilMapResult>(`map.brazil.${p.indicator}`, BrazilMapSchema, (d) => {
      const idx = d.weeks.map((w, i) => i).filter((i) => (!p.from || d.weeks[i]! >= p.from) && (!p.to || d.weeks[i]! <= p.to));
      const pick = <T,>(a: T[]) => idx.map((i) => a[i]!);
      return norm({
        ...d,
        weeks: pick(d.weeks),
        states: d.states.map((s) => ({ ...s, values: pick(s.values), suppressed: pick(s.suppressed) })),
        national: { values: pick(d.national.values), provisional: pick(d.national.provisional) },
      });
    });
  }
  const r = await request<BrazilMapResult>(`/v1/map/brazil${buildQuery({ indicator: p.indicator, from: p.from, to: p.to })}`, BrazilMapSchema);
  return r.ok ? { ...r, data: norm(r.data) } : r;
}

/** Sinais EARS (C1/C2/C3) por geografia: sinal estatístico, não surto confirmado. */
export async function getEars(p: { indicator: string; geo_level?: 'state' | 'country'; weeks?: number }): Promise<ApiResult<EarsResult>> {
  if (!SAFE_ID.test(p.indicator)) return unavailable('Identificador de indicador inválido', 'not_found');
  const level = p.geo_level ?? 'state';
  if (isMockMode()) return mock<EarsResult>(`ears.${p.indicator}.${level}`, EarsSchema);
  return request<EarsResult>(`/v1/analytics/ears${buildQuery({ indicator: p.indicator, geo_level: level, weeks: p.weeks ?? 12 })}`, EarsSchema);
}

/** Nowcast (estimativa de notificações ainda não digitadas). 404 nowcast_unavailable → status 'not_found'. */
export async function getNowcast(p: { indicator: string; geo_code?: string; weeks?: number }): Promise<ApiResult<NowcastResult>> {
  if (!SAFE_ID.test(p.indicator)) return unavailable('Identificador de indicador inválido', 'not_found');
  const geo = p.geo_code ?? 'BRA';
  if (!SAFE_GEO.test(geo)) return unavailable('Código geográfico inválido', 'not_found');
  if (isMockMode()) return mock<NowcastResult>(`nowcast.${p.indicator}.${geo}`, NowcastSchema);
  return request<NowcastResult>(`/v1/analytics/nowcast${buildQuery({ indicator: p.indicator, geo_code: geo, weeks: p.weeks ?? 8 })}`, NowcastSchema);
}

/** Sobreposição de temporadas (uma série por ano, semanas 1..53). */
export async function getSeasons(p: { indicator: string; geo_code?: string; from_year?: number }): Promise<ApiResult<SeasonsResult>> {
  if (!SAFE_ID.test(p.indicator)) return unavailable('Identificador de indicador inválido', 'not_found');
  const geo = p.geo_code ?? 'BRA';
  if (!SAFE_GEO.test(geo)) return unavailable('Código geográfico inválido', 'not_found');
  if (isMockMode()) {
    return mock<SeasonsResult>(`seasons.${p.indicator}.${geo}`, SeasonsSchema, (d) => ({ ...d, seasons: d.seasons.filter((s) => !p.from_year || s.year >= p.from_year) }));
  }
  return request<SeasonsResult>(`/v1/analytics/seasons${buildQuery({ indicator: p.indicator, geo_code: geo, from_year: p.from_year })}`, SeasonsSchema);
}

/** Últimas execuções dos conectores (console de ingestão): "última execução", nunca um estado corrente. */
export async function getRuns(limit = 30): Promise<ApiResult<RunsResult>> {
  if (isMockMode()) return mock<RunsResult>('runs', RunsSchema, (d) => ({ data: d.data.slice(0, limit) }));
  return request<RunsResult>(`/v1/runs${buildQuery({ limit })}`, RunsSchema);
}

/** Último valor publicável de um indicador para uma geografia. Célula suprimida nunca carrega valor. */
export async function getLatest(indicator: string, geo_code = 'BRA'): Promise<ApiResult<LatestResult>> {
  if (!SAFE_ID.test(indicator)) return unavailable('Identificador de indicador inválido', 'not_found');
  if (!SAFE_GEO.test(geo_code)) return unavailable('Código geográfico inválido', 'not_found');
  const norm = (d: LatestResult): LatestResult => (d.suppressed ? { ...d, value: null } : d);
  if (isMockMode()) return mock<LatestResult>(`latest.${indicator}.${geo_code}`, LatestSchema, norm);
  const r = await request<LatestResult>(`/v1/indicators/${encodeURIComponent(indicator)}/latest${buildQuery({ geo_code })}`, LatestSchema);
  return r.ok ? { ...r, data: norm(r.data) } : r;
}
