import {
  applySuppression,
  getIndicator,
  stratumKey,
  type GeoLevel,
  type Observation,
  type PublishedObservation,
  type IndicatorDefinition,
  type Snapshot,
} from '@h1n1/core';
import type { Db } from './client.js';

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

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

export interface SeriesQuery {
  indicator: string;
  geoLevel?: GeoLevel;
  geoCode?: string;
  from?: string; // período inicial (inclusive), ex. 2025-W01
  to?: string;
  stratum?: Record<string, string>;
  /** inclui estratos além do total; default: só total ('' stratum_key) quando stratum não informado */
  includeStrata?: boolean;
  limit?: number;
}

/** Teto público de observações por resposta. */
export const SERIES_MAX_LIMIT = 100000;
export const SERIES_DEFAULT_LIMIT = 20000;
/**
 * Teto de linhas lidas do banco quando a supressão precisa do grupo completo (total + todos os estratos).
 * Acima disso o último grupo (geo/período) lido é descartado por poder estar incompleto.
 */
const GROUP_SCAN_CAP = 500000;

export interface SeriesResult {
  indicator: IndicatorRow;
  source: SourceRow;
  publication: PublicationRow | null;
  snapshot: Snapshot | null;
  observations: PublishedObservation[];
  meta: {
    data_as_of: string | null;
    fetched_at: string | null;
    universe_note: string;
    case_definition: string;
    license: string | null;
    suppression_threshold: number;
    caveats: string[];
    count: number;
    /** true quando o número de observações atingiu `limit` (resultado possivelmente cortado; refine a consulta) */
    truncated: boolean;
  };
}

export async function listSources(db: Db, filter: { priority?: string; country?: string; accessType?: string } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.priority) { params.push(filter.priority); where.push(`priority = $${params.length}`); }
  if (filter.country) { params.push(filter.country); where.push(`country = $${params.length}`); }
  if (filter.accessType) { params.push(filter.accessType); where.push(`access_type = $${params.length}`); }
  const sql = `select * from sources ${where.length ? 'where ' + where.join(' and ') : ''} order by priority, id`;
  return (await db.query<SourceRow>(sql, params)).rows;
}

export async function getSource(db: Db, idOrSlug: string): Promise<SourceRow | null> {
  const r = await db.query<SourceRow>('select * from sources where id = $1 or slug = $1 limit 1', [idOrSlug]);
  return r.rows[0] ?? null;
}

export async function listIndicators(db: Db, filter: { sourceId?: string } = {}): Promise<IndicatorRow[]> {
  const params: unknown[] = [];
  let sql = 'select * from indicators';
  if (filter.sourceId) { params.push(filter.sourceId); sql += ` where source_id = $1`; }
  sql += ' order by id';
  return (await db.query<IndicatorRow>(sql, params)).rows;
}

export async function getIndicatorRow(db: Db, id: string): Promise<IndicatorRow | null> {
  const r = await db.query<IndicatorRow>('select * from indicators where id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function getCurrentPublication(db: Db, indicatorId: string): Promise<PublicationRow | null> {
  const r = await db.query<PublicationRow>(
    `select indicator_id, snapshot_id::text as snapshot_id, published_at::text as published_at,
            data_as_of::text as data_as_of, status, validation_report
       from indicator_publications where indicator_id = $1 and status = 'current' limit 1`,
    [indicatorId],
  );
  return r.rows[0] ?? null;
}

const SNAPSHOT_COLS = `id::text as id, source_id, url, fetched_at::text as fetched_at, sha256, bytes, content_type,
  license, storage_path, data_as_of::text as data_as_of, status, notes`;

export async function getSnapshot(db: Db, id: string): Promise<Snapshot | null> {
  const r = await db.query<Snapshot>(`select ${SNAPSHOT_COLS} from snapshots where id = $1`, [id]);
  const row = r.rows[0];
  return row ? { ...row, bytes: num(row.bytes) } : null;
}

export async function listSnapshots(db: Db, filter: { sourceId?: string; limit?: number } = {}): Promise<Snapshot[]> {
  const params: unknown[] = [];
  let sql = `select ${SNAPSHOT_COLS} from snapshots`;
  if (filter.sourceId) { params.push(filter.sourceId); sql += ` where source_id = $1`; }
  params.push(filter.limit ?? 100);
  sql += ` order by fetched_at desc limit $${params.length}`;
  return (await db.query<Snapshot>(sql, params)).rows.map((r) => ({ ...r, bytes: num(r.bytes) }));
}

/**
 * Série publicada: só a snapshot vigente do indicador, com supressão aplicada na saída.
 * Nunca devolve valores brutos de células suprimidas.
 *
 * Supressão complementar: quando a consulta pede um estrato específico ou `includeStrata`, TODAS as células do
 * grupo (total + todos os estratos) das geos/períodos selecionados são lidas, a supressão é aplicada sobre o
 * conjunto completo e só depois o resultado é filtrado para o que foi pedido. Assim, consultar um único estrato
 * não contorna a supressão complementar calculada sobre o grupo.
 */
export async function getSeries(db: Db, q: SeriesQuery): Promise<SeriesResult | null> {
  const indicator = await getIndicatorRow(db, q.indicator);
  if (!indicator) return null;
  const source = await getSource(db, indicator.source_id);
  if (!source) return null;
  const publication = await getCurrentPublication(db, q.indicator);
  const def = getIndicator(q.indicator);
  const snapshot = publication ? await getSnapshot(db, publication.snapshot_id) : null;
  const limit = Math.min(Math.max(1, q.limit ?? SERIES_DEFAULT_LIMIT), SERIES_MAX_LIMIT);

  let observations: PublishedObservation[] = [];
  let truncated = false;
  if (publication) {
    const stratumFilter = q.stratum && Object.keys(q.stratum).length ? q.stratum : undefined;
    const requestedKey = stratumFilter ? stratumKey(stratumFilter) : null;
    // grupo completo (total + estratos) é necessário sempre que algum estrato pode sair na resposta
    const needGroup = requestedKey !== null || q.includeStrata === true;

    const params: unknown[] = [q.indicator, publication.snapshot_id];
    const where = ['indicator_id = $1', 'snapshot_id = $2'];
    if (q.geoLevel) { params.push(q.geoLevel); where.push(`geo_level = $${params.length}`); }
    if (q.geoCode) { params.push(q.geoCode); where.push(`geo_code = $${params.length}`); }
    if (q.from) { params.push(q.from); where.push(`period >= $${params.length}`); }
    if (q.to) { params.push(q.to); where.push(`period <= $${params.length}`); }
    if (!needGroup) where.push(`stratum_key = ''`);
    params.push(needGroup ? GROUP_SCAN_CAP : limit);
    const sql = `select indicator_id, snapshot_id::text as snapshot_id, geo_level, geo_code, period_type, period,
        period_start::text as period_start, period_end::text as period_end, value, denominator, stratum, stratum_key,
        update_status, quality_flags
      from observations where ${where.join(' and ')}
      order by geo_code, period, stratum_key limit $${params.length}`;
    let rows = (await db.query<Record<string, unknown>>(sql, params)).rows;
    if (needGroup && rows.length >= GROUP_SCAN_CAP) {
      // o último grupo lido pode estar incompleto: descarta-o para não aplicar supressão parcial
      const last = rows[rows.length - 1]!;
      const lastGroup = `${last.geo_level}|${last.geo_code}|${last.period_type}|${last.period}`;
      rows = rows.filter((r) => `${r.geo_level}|${r.geo_code}|${r.period_type}|${r.period}` !== lastGroup);
      truncated = true;
    }
    const obs: Observation[] = rows.map((r) => ({
      indicator_id: String(r.indicator_id),
      snapshot_id: String(r.snapshot_id),
      geo_level: r.geo_level as GeoLevel,
      geo_code: String(r.geo_code),
      period_type: r.period_type as Observation['period_type'],
      period: String(r.period),
      period_start: String(r.period_start).slice(0, 10),
      period_end: String(r.period_end).slice(0, 10),
      value: num(r.value),
      denominator: num(r.denominator),
      stratum: (typeof r.stratum === 'string' ? JSON.parse(r.stratum) : r.stratum ?? {}) as Record<string, string>,
      update_status: r.update_status as Observation['update_status'],
      quality_flags: (r.quality_flags as string[]) ?? [],
    }));
    // Razões com denominador pequeno não são publicadas (min_denominator)
    if (def.min_denominator) {
      for (const o of obs) if (o.denominator !== null && o.denominator < def.min_denominator) { o.value = null; o.quality_flags = [...o.quality_flags, 'denominator_below_minimum']; }
    }
    let published = applySuppression(obs, { threshold: def.suppression_threshold });
    if (requestedKey !== null) published = published.filter((o) => stratumKey(o.stratum) === requestedKey);
    if (published.length > limit) { published = published.slice(0, limit); }
    if (published.length >= limit) truncated = true;
    observations = published;
  }

  return {
    indicator,
    source,
    publication,
    snapshot,
    observations,
    meta: {
      data_as_of: publication?.data_as_of ?? snapshot?.data_as_of ?? null,
      fetched_at: snapshot?.fetched_at ?? null,
      universe_note: indicator.universe_note,
      case_definition: indicator.case_definition,
      license: snapshot?.license ?? source.license ?? null,
      suppression_threshold: indicator.suppression_threshold,
      caveats: indicator.caveats,
      count: observations.length,
      truncated,
    },
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

export async function getFreshness(db: Db): Promise<FreshnessRow[]> {
  const sql = `
    select i.id as indicator_id, i.source_id, p.snapshot_id::text as snapshot_id,
      coalesce(p.data_as_of, s.data_as_of)::text as data_as_of, s.fetched_at::text as fetched_at,
      p.published_at::text as published_at,
      case when s.fetched_at is null then null else floor(extract(epoch from (now() - s.fetched_at)) / 86400) end as age_days,
      r.status as last_run_status, r.finished_at::text as last_run_finished_at
    from indicators i
    left join indicator_publications p on p.indicator_id = i.id and p.status = 'current'
    left join snapshots s on s.id = p.snapshot_id
    left join lateral (
      select status, finished_at from ingestion_runs ir where ir.source_id = i.source_id order by started_at desc limit 1
    ) r on true
    order by i.id`;
  return (await db.query<FreshnessRow>(sql)).rows.map((r) => ({ ...r, age_days: num(r.age_days) }));
}

export interface PublishInput {
  indicatorId: string;
  snapshotId: string;
  dataAsOf: string | null;
  validationReport?: Record<string, unknown>;
}

/** Publica uma snapshot como vigente para o indicador, superseding a anterior (regra 10: atômico). */
export async function publishIndicator(db: Db, input: PublishInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `update indicator_publications set status = 'superseded', superseded_at = now()
         where indicator_id = $1 and status = 'current'`,
      [input.indicatorId],
    );
    await tx.query(
      `insert into indicator_publications (indicator_id, snapshot_id, status, data_as_of, validation_report)
         values ($1, $2, 'current', $3, $4)`,
      [input.indicatorId, input.snapshotId, input.dataAsOf, JSON.stringify(input.validationReport ?? {})],
    );
  });
}

export async function rejectPublication(db: Db, indicatorId: string, snapshotId: string, report: Record<string, unknown>): Promise<void> {
  await db.query(
    `insert into indicator_publications (indicator_id, snapshot_id, status, validation_report) values ($1, $2, 'rejected', $3)`,
    [indicatorId, snapshotId, JSON.stringify(report)],
  );
}

/**
 * Compara a mesma célula entre duas snapshots (pesquisa R07: revisões retrospectivas).
 * Nesta versão o diff é restrito a geo_level = 'country' sem estrato (stratum_key = ''): células subnacionais
 * ou estratificadas nunca saem daqui, para que o diff não sirva de canal de reconstrução de células suprimidas.
 * A máscara de supressão é mantida como defesa em profundidade (threshold do indicador).
 */
export async function diffSnapshots(db: Db, indicatorId: string, snapshotA: string, snapshotB: string, limit = 5000) {
  const indicator = await getIndicatorRow(db, indicatorId);
  const threshold = indicator?.suppression_threshold ?? 0;
  const sql = `
    select coalesce(a.geo_level, b.geo_level) as geo_level, coalesce(a.geo_code, b.geo_code) as geo_code,
      coalesce(a.period, b.period) as period, coalesce(a.stratum_key, b.stratum_key) as stratum_key,
      a.value as value_a, b.value as value_b
    from (select * from observations where indicator_id = $1 and snapshot_id = $2 and geo_level = 'country' and stratum_key = '') a
    full outer join (select * from observations where indicator_id = $1 and snapshot_id = $3 and geo_level = 'country' and stratum_key = '') b
      on a.geo_level = b.geo_level and a.geo_code = b.geo_code and a.period = b.period and a.stratum_key = b.stratum_key
    where a.value is distinct from b.value
    order by 3, 2, 4 limit $4`;
  const rows = (await db.query<{ geo_level: string; geo_code: string; period: string; stratum_key: string; value_a: unknown; value_b: unknown }>(sql, [indicatorId, snapshotA, snapshotB, limit])).rows;
  const sensitive = (r: { geo_level: string; stratum_key: string }) =>
    threshold > 0 && (r.geo_level !== 'country' || r.stratum_key !== '');
  const mask = (v: number | null, r: { geo_level: string; stratum_key: string }) =>
    v !== null && v > 0 && v < threshold && sensitive(r) ? null : v;
  return rows
    .map((r) => {
      const va = num(r.value_a);
      const vb = num(r.value_b);
      const a = mask(va, r);
      const b = mask(vb, r);
      return { ...r, value_a: a, value_b: b, suppressed: a !== va || b !== vb };
    })
    .filter((r) => !(r.suppressed && r.value_a === null && r.value_b === null && num(r.value_a) === num(r.value_b)));
}

// ---------------------------------------------------------------------------------------------------------
// Visualização e análise (CONTRATO_API.md §3.13)
// ---------------------------------------------------------------------------------------------------------

export interface MatrixQuery {
  indicator: string;
  geoLevel: GeoLevel;
  /** chave canônica do estrato (default '' = total) */
  stratumKey?: string;
  from?: string;
  to?: string;
  /** restringe às geos informadas (ex.: países com centroide) */
  geoCodes?: readonly string[];
}

export interface MatrixRow {
  geo_code: string;
  /** alinhado a `periods`; null quando a célula não existe na snapshot vigente */
  values: (number | null)[];
  /** alinhado a `periods`; true quando a célula existe e está provisória */
  provisional: boolean[];
}

export interface MatrixResult {
  indicator: IndicatorRow;
  source: SourceRow;
  publication: PublicationRow | null;
  snapshot: Snapshot | null;
  /** períodos distintos presentes, ordenados */
  periods: string[];
  rows: MatrixRow[];
  meta: SeriesResult['meta'];
}

/** Teto de células lidas para a matriz (geo × período). */
const MATRIX_SCAN_CAP = 1_000_000;

/**
 * Matriz geo × período de um único estrato da snapshot vigente, em UMA consulta, agrupada em memória.
 * Destinada a visualizações densas (globo, mapa) de indicadores SEM supressão (threshold 0): aplica a máscara
 * de supressão simples do indicador como defesa em profundidade (valor < threshold em recorte não nacional →
 * null), mas NÃO calcula supressão complementar — para indicadores com threshold > 0 e estratos use getSeries.
 */
export async function getMatrix(db: Db, q: MatrixQuery): Promise<MatrixResult | null> {
  const indicator = await getIndicatorRow(db, q.indicator);
  if (!indicator) return null;
  const source = await getSource(db, indicator.source_id);
  if (!source) return null;
  const publication = await getCurrentPublication(db, q.indicator);
  const snapshot = publication ? await getSnapshot(db, publication.snapshot_id) : null;
  const threshold = indicator.suppression_threshold;

  const periodSet = new Set<string>();
  const byGeo = new Map<string, Map<string, { value: number | null; provisional: boolean }>>();
  let truncated = false;
  if (publication) {
    const params: unknown[] = [q.indicator, publication.snapshot_id, q.geoLevel, q.stratumKey ?? ''];
    const where = ['indicator_id = $1', 'snapshot_id = $2', 'geo_level = $3', 'stratum_key = $4'];
    if (q.from) { params.push(q.from); where.push(`period >= $${params.length}`); }
    if (q.to) { params.push(q.to); where.push(`period <= $${params.length}`); }
    if (q.geoCodes && q.geoCodes.length) { params.push([...q.geoCodes]); where.push(`geo_code = any($${params.length}::text[])`); }
    params.push(MATRIX_SCAN_CAP);
    const sql = `select geo_code, period, value, update_status from observations
      where ${where.join(' and ')} order by geo_code, period limit $${params.length}`;
    const rows = (await db.query<{ geo_code: string; period: string; value: unknown; update_status: string }>(sql, params)).rows;
    if (rows.length >= MATRIX_SCAN_CAP) truncated = true;
    const exempt = q.geoLevel === 'country' && (q.stratumKey ?? '') === '';
    for (const r of rows) {
      let value = num(r.value);
      if (threshold > 0 && !exempt && value !== null && value > 0 && value < threshold) value = null;
      periodSet.add(r.period);
      let cells = byGeo.get(r.geo_code);
      if (!cells) { cells = new Map(); byGeo.set(r.geo_code, cells); }
      cells.set(r.period, { value, provisional: r.update_status === 'provisional' });
    }
  }
  const periods = [...periodSet].sort();
  const out: MatrixRow[] = [];
  for (const [geo_code, cells] of byGeo) {
    const values: (number | null)[] = new Array(periods.length).fill(null);
    const provisional: boolean[] = new Array(periods.length).fill(false);
    periods.forEach((p, i) => {
      const c = cells.get(p);
      if (c) { values[i] = c.value; provisional[i] = c.provisional; }
    });
    out.push({ geo_code, values, provisional });
  }
  out.sort((a, b) => (a.geo_code < b.geo_code ? -1 : a.geo_code > b.geo_code ? 1 : 0));
  let count = 0;
  for (const r of out) count += r.values.length;
  return {
    indicator, source, publication, snapshot, periods, rows: out,
    meta: {
      data_as_of: publication?.data_as_of ?? snapshot?.data_as_of ?? null,
      fetched_at: snapshot?.fetched_at ?? null,
      universe_note: indicator.universe_note,
      case_definition: indicator.case_definition,
      license: snapshot?.license ?? source.license ?? null,
      suppression_threshold: indicator.suppression_threshold,
      caveats: indicator.caveats,
      count,
      truncated,
    },
  };
}

export interface IngestionRunRow {
  id: string;
  connector: string;
  source_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  rows_in: number;
  rows_out: number;
  /** mensagem de erro já higienizada: sem caminhos de disco, truncada a 200 caracteres */
  error: string | null;
}

export const RUN_ERROR_MAX = 200;

/** Caminhos absolutos POSIX (/a/b/c.ext), relativos com ./ ou ../, e Windows (C:\a\b). */
const DISK_PATH_RE = /(?:[A-Za-z]:\\(?:[^\\\s'"`]+\\)*[^\\\s'"`]*)|(?:(?:^|[\s('"`=:])\.{0,2}\/(?:[^/\s'"`)]+\/)*[^/\s'"`)]*)/g;

/** URLs inteiras (inclusive credenciais user:pass@ e query string) → `[url]`, antes de qualquer outra regra. */
const URL_RE = /https?:\/\/\S+/gi;
/** Credenciais soltas no texto: token=..., key=..., api_key: ..., authorization: Bearer ... (case-insensitive). */
const CREDENTIAL_RE = /\b(authorization|api[_-]?key|access[_-]?key|secret[_-]?key|token|key|password|secret)\b(\s*[=:]\s*)(?:bearer\s+)?[^\s'"`,;)]+/gi;

/**
 * Higieniza a mensagem de erro de uma run (nunca exponha o texto cru): URLs → `[url]`, credenciais
 * (`token=`, `key=`, `authorization`) → `[redigido]`, caminhos de disco → `[caminho]`, truncada a 200 caracteres.
 */
export function sanitizeRunError(error: string | null | undefined): string | null {
  if (error === null || error === undefined) return null;
  let s = String(error).replace(/[\u0000-\u001F\u007F]+/g, ' ');
  s = s.replace(URL_RE, '[url]');
  s = s.replace(CREDENTIAL_RE, (_m, name: string) => `${name.toLowerCase()}=[redigido]`);
  s = s.replace(DISK_PATH_RE, (m) => {
    const lead = /^[\s('"`=:]/.test(m) ? m[0]! : '';
    return `${lead}[caminho]`;
  });
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > RUN_ERROR_MAX) s = s.slice(0, RUN_ERROR_MAX - 1) + '…';
  return s.length ? s : null;
}

/** Execuções de ingestão (ingestion_runs), mais recentes primeiro, sem params nem caminhos de disco. */
export async function listIngestionRuns(db: Db, filter: { sourceId?: string; limit?: number } = {}): Promise<IngestionRunRow[]> {
  const params: unknown[] = [];
  let sql = `select id::text as id, connector, source_id, started_at::text as started_at, finished_at::text as finished_at,
    status, rows_in, rows_out, error from ingestion_runs`;
  if (filter.sourceId) { params.push(filter.sourceId); sql += ` where source_id = $1`; }
  params.push(Math.min(Math.max(1, filter.limit ?? 50), 500));
  sql += ` order by started_at desc, id desc limit $${params.length}`;
  const rows = (await db.query<Record<string, unknown>>(sql, params)).rows;
  return rows.map((r) => ({
    id: String(r.id),
    connector: String(r.connector),
    source_id: String(r.source_id),
    started_at: String(r.started_at),
    finished_at: r.finished_at === null || r.finished_at === undefined ? null : String(r.finished_at),
    status: String(r.status),
    rows_in: num(r.rows_in) ?? 0,
    rows_out: num(r.rows_out) ?? 0,
    error: sanitizeRunError(r.error as string | null),
  }));
}
