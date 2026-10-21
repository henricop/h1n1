import type { FastifyInstance } from 'fastify';
import { BR_STATES, COUNTRY_CENTROIDS } from '@h1n1/core';
import { getSeries, getMatrix, getIndicatorRow, getCurrentPublication, type Db, type IndicatorRow, type SeriesResult } from '@h1n1/db';
import { LruCache, cacheKey, type LruCacheOptions } from '../cache.js';
import type { PublishedObservation } from '@h1n1/core';
import { parseOr400, globeQuery, mapBrazilQuery, normalizePeriodRange, type PeriodType } from '../schemas.js';
import { notFound, badRequest, tooManyRows } from '../errors.js';
import { GLOBE_QUERY, GLOBE_RESPONSE, MAP_BRAZIL_QUERY, MAP_BRAZIL_RESPONSE, errorResponses } from '../openapi.js';

/** Metadados compactos das rotas de visualização/análise (CONTRATO_API.md §3.13). */
export interface VizMeta {
  data_as_of: string | null;
  universe_note: string;
  license: string | null;
  source_id: string;
  case_definition: string;
  caveats: string[];
  /** true quando a leitura atingiu o limite de linhas (resultado possivelmente incompleto) */
  truncated: boolean;
}

export function vizMeta(r: { meta: SeriesResult['meta']; source: { id: string } }): VizMeta {
  return {
    data_as_of: r.meta.data_as_of,
    universe_note: r.meta.universe_note,
    license: r.meta.license,
    source_id: r.source.id,
    case_definition: r.meta.case_definition,
    caveats: r.meta.caveats,
    truncated: r.meta.truncated,
  };
}

/**
 * Rotas de análise não operam sobre série cortada pelo limite de linhas: 400 too_many_rows.
 * (Globo e mapa mantêm 200 e sinalizam em meta.truncated.)
 */
export function requireComplete<T extends { meta: SeriesResult['meta'] }>(r: T, what: string): T {
  if (r.meta.truncated) {
    throw tooManyRows(`${what}: a série excede o limite de linhas e a análise seria calculada sobre dados incompletos; reduza o intervalo (from/to) ou o recorte.`);
  }
  return r;
}

export interface VizRouteOptions {
  db: Db;
  /** máximo de observações lidas por série (ver BuildAppOptions.vizRowLimit) */
  rowLimit?: number;
  /**
   * Cache LRU em memória das respostas prontas de /v1/globe e /v1/map/brazil (default: TTL 10 min, 50 entradas).
   * `false` desliga. A chave inclui a snapshot da publicação vigente: publicação nova → chave nova.
   */
  cache?: LruCacheOptions | false;
}

export const indicatorRef = (i: IndicatorRow) => ({ id: i.id, name: i.name });

/** Indicador existente (404) com período normalizado; `check` aplica a restrição da rota (400). */
export async function requireIndicator(
  db: Db,
  id: string,
  check?: { ok: (i: IndicatorRow) => boolean; message: string },
): Promise<IndicatorRow> {
  const indicator = await getIndicatorRow(db, id);
  if (!indicator) throw notFound(`Indicador não encontrado: ${id}`);
  if (check && !check.ok(indicator)) throw badRequest(`indicator: ${check.message}`);
  return indicator;
}

/** Alinha observações (total) a um eixo de períodos. */
export function alignToAxis(
  obs: readonly PublishedObservation[],
  axis: readonly string[],
): { values: (number | null)[]; suppressed: boolean[]; provisional: boolean[]; present: boolean[] } {
  const idx = new Map(axis.map((p, i) => [p, i]));
  const values: (number | null)[] = new Array(axis.length).fill(null);
  const suppressed: boolean[] = new Array(axis.length).fill(false);
  const provisional: boolean[] = new Array(axis.length).fill(false);
  const present: boolean[] = new Array(axis.length).fill(false);
  for (const o of obs) {
    const i = idx.get(o.period);
    if (i === undefined) continue;
    values[i] = o.suppressed ? null : o.value;
    suppressed[i] = o.suppressed;
    provisional[i] = o.update_status === 'provisional';
    present[i] = true;
  }
  return { values, suppressed, provisional, present };
}

export async function vizRoutes(app: FastifyInstance, opts: VizRouteOptions) {
  const { db } = opts;
  const limit = opts.rowLimit ?? 100000;
  const cache = opts.cache === false ? null : new LruCache<unknown>(opts.cache ?? {});

  app.get('/v1/globe', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['visualização'],
      summary: 'Matriz país × semana (FluNet) para o globo, com centroides',
      description:
        'Só indicadores flunet_* de contagem (measurement=count; 400 caso contrário — percentuais como positividade não ' +
        'são comparáveis entre países no globo) e só países com centroide conhecido (COUNTRY_CENTROIDS); países sem ' +
        'nenhum valor no intervalo são omitidos. values alinhado a weeks (null = célula ausente). origin=all usa o total; ' +
        'os demais valores selecionam o estrato origin_source. meta.truncated=true sinaliza leitura cortada. Cache 300 s + ETag.',
      querystring: GLOBE_QUERY,
      response: { 200: GLOBE_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req, reply) => {
    const q = parseOr400(globeQuery, req.query);
    const indicator = await requireIndicator(db, q.indicator, {
      ok: (i) => i.id.startsWith('flunet_') && i.geo_levels.includes('country') && i.measurement === 'count',
      message: 'o globo só aceita indicadores flunet_* de contagem (measurement=count) com nível country',
    });
    const range = normalizePeriodRange(q.from, q.to, indicator.period_type as PeriodType);
    const origin = q.origin ?? 'all';
    // chave = indicador | snapshot vigente | from | to | origin — publicação nova invalida automaticamente
    const key = cache ? cacheKey(['globe', indicator.id, (await getCurrentPublication(db, indicator.id))?.snapshot_id, range.from, range.to, origin]) : null;
    const hit = key ? cache!.get(key) : undefined;
    if (hit !== undefined) {
      reply.header('X-Cache', 'HIT');
      return hit;
    }
    const m = await getMatrix(db, {
      indicator: indicator.id,
      geoLevel: 'country',
      stratumKey: origin === 'all' ? '' : `origin_source=${origin}`,
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
      geoCodes: COUNTRY_CENTROIDS.map((c) => c.iso3),
    });
    if (!m) throw notFound(`Indicador não encontrado: ${q.indicator}`);
    const byIso = new Map(m.rows.map((r) => [r.geo_code, r]));
    const countries = [];
    for (const c of COUNTRY_CENTROIDS) {
      const row = byIso.get(c.iso3);
      if (!row || row.values.every((v) => v === null)) continue;
      countries.push({ iso3: c.iso3, name: c.name, lat: c.lat, lon: c.lon, who_region: c.who_region, values: row.values });
    }
    const body = { indicator: indicatorRef(indicator), meta: vizMeta(m), weeks: m.periods, countries };
    if (key) {
      cache!.set(key, body);
      reply.header('X-Cache', 'MISS');
    }
    return body;
  });

  app.get('/v1/map/brazil', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['visualização'],
      summary: 'Matriz UF × semana com supressão aplicada e total nacional (mapa do Brasil)',
      description:
        'Só indicadores com geo_levels contendo state (400 caso contrário). Reutiliza a série publicada por UF e o total nacional: ' +
        'células suprimidas saem com value null e suppressed true (o valor bruto nunca é exposto); todas as 27 UFs aparecem, com ' +
        'null onde não há dado. weeks = união dos períodos publicados. meta.truncated=true sinaliza leitura cortada. Cache 300 s + ETag.',
      querystring: MAP_BRAZIL_QUERY,
      response: { 200: MAP_BRAZIL_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req, reply) => {
    const q = parseOr400(mapBrazilQuery, req.query);
    const indicator = await requireIndicator(db, q.indicator, {
      ok: (i) => i.geo_levels.includes('state'),
      message: 'o mapa do Brasil só aceita indicadores com nível state',
    });
    const range = normalizePeriodRange(q.from, q.to, indicator.period_type as PeriodType);
    const key = cache ? cacheKey(['map', indicator.id, (await getCurrentPublication(db, indicator.id))?.snapshot_id, range.from, range.to]) : null;
    const hit = key ? cache!.get(key) : undefined;
    if (hit !== undefined) {
      reply.header('X-Cache', 'HIT');
      return hit;
    }
    const base = { indicator: indicator.id, limit, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) };
    const [states, national] = await Promise.all([
      getSeries(db, { ...base, geoLevel: 'state' }),
      getSeries(db, { ...base, geoLevel: 'country', geoCode: 'BRA' }),
    ]);
    if (!states || !national) throw notFound(`Indicador não encontrado: ${q.indicator}`);
    const weeks = [...new Set([...states.observations, ...national.observations].map((o) => o.period))].sort();
    const byState = new Map<string, PublishedObservation[]>();
    for (const o of states.observations) {
      const arr = byState.get(o.geo_code);
      if (arr) arr.push(o);
      else byState.set(o.geo_code, [o]);
    }
    const out = BR_STATES.map((s) => {
      const code = `BR-${s.uf}`;
      const a = alignToAxis(byState.get(code) ?? [], weeks);
      return { code, uf: s.uf, name: s.name, ibge: s.ibge, values: a.values, suppressed: a.suppressed };
    });
    const nat = alignToAxis(national.observations, weeks);
    const body = {
      indicator: indicatorRef(indicator),
      meta: { ...vizMeta(states), truncated: states.meta.truncated || national.meta.truncated },
      weeks,
      states: out,
      national: { values: nat.values, provisional: nat.provisional },
    };
    if (key) {
      cache!.set(key, body);
      reply.header('X-Cache', 'MISS');
    }
    return body;
  });
}
