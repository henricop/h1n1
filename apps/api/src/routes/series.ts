import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getSeries, getIndicatorRow, type Db, type SeriesQuery, type SeriesResult } from '@h1n1/db';
import { parseSeriesQuery, normalizePeriodRange, type PeriodType } from '../schemas.js';
import { notFound } from '../errors.js';
import { seriesToCsv } from '../csv.js';
import { SERIES_QUERY, SERIES_RESPONSE, errorResponses } from '../openapi.js';
import { publicSnapshot, type PublicSnapshot } from './snapshots.js';

export type PublicSeriesResult = Omit<SeriesResult, 'snapshot'> & { snapshot: PublicSnapshot | null };

async function loadSeries(db: Db, req: FastifyRequest): Promise<PublicSeriesResult> {
  const p = parseSeriesQuery((req.query ?? {}) as Record<string, unknown>);
  const indicator = await getIndicatorRow(db, p.indicator);
  if (!indicator) throw notFound(`Indicador não encontrado: ${p.indicator}`);
  const range = normalizePeriodRange(p.from, p.to, indicator.period_type as PeriodType);
  const q: SeriesQuery = { indicator: p.indicator };
  if (p.geoLevel) q.geoLevel = p.geoLevel;
  if (p.geoCode) q.geoCode = p.geoCode;
  if (range.from) q.from = range.from;
  if (range.to) q.to = range.to;
  if (p.includeStrata !== undefined) q.includeStrata = p.includeStrata;
  if (p.limit !== undefined) q.limit = p.limit;
  if (p.stratum) q.stratum = p.stratum;
  const result = await getSeries(db, q);
  if (!result) throw notFound(`Indicador não encontrado: ${p.indicator}`);
  return { ...result, snapshot: result.snapshot ? publicSnapshot(result.snapshot) : null };
}

export interface SeriesRoutesOptions {
  db: Db;
  /** limite por IP por minuto em /v1/series.csv; 0 ou undefined usa o limite global */
  csvRateLimitMax?: number;
}

export async function seriesRoutes(app: FastifyInstance, opts: SeriesRoutesOptions) {
  const { db } = opts;
  const csvRateLimit =
    opts.csvRateLimitMax && opts.csvRateLimitMax > 0
      ? { rateLimit: { max: opts.csvRateLimitMax, timeWindow: '1 minute', groupId: 'series-csv' } }
      : {};

  app.get('/v1/series', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['séries'],
      summary: 'Série temporal publicada de um indicador (snapshot vigente, supressão aplicada)',
      description:
        'Devolve exclusivamente observações da snapshot vigente do indicador. Sem publicação vigente, responde 200 com ' +
        'observations vazio e meta.data_as_of null — nunca inventa dado. Exiba meta.universe_note junto a qualquer número. ' +
        'A supressão complementar é calculada sobre o grupo completo (total + todos os estratos) mesmo quando só um estrato é pedido. ' +
        'from/to aceitam AAAA, AAAA-Www ou AAAA-Mnn; AAAA é expandido para o primeiro (from) ou último (to) período do ano; ' +
        'from > to responde 400. meta.truncated=true quando o número de observações atingiu limit. ' +
        'Cache-Control: public, max-age=300, stale-while-revalidate=3600 + ETag (If-None-Match → 304).',
      querystring: SERIES_QUERY,
      response: { 200: SERIES_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req) => loadSeries(db, req));

  app.get('/v1/series.csv', {
    config: { cache: 'series', etag: true, ...csvRateLimit },
    schema: {
      tags: ['séries'],
      summary: 'Mesma série em CSV (download)',
      description:
        'Colunas: indicator_id,geo_level,geo_code,period_type,period,period_start,period_end,value,denominator,suppressed,' +
        'update_status,stratum_key,quality_flags,snapshot_id,data_as_of,source_id,license. Células suprimidas saem com value vazio e suppressed=true. ' +
        'Cabeçalho X-Truncated: true quando o número de linhas atingiu limit. Limite próprio de requisições por IP (20/min por padrão).',
      querystring: SERIES_QUERY,
      produces: ['text/csv'],
      response: { 200: { type: 'string', description: 'CSV' }, ...errorResponses(400, 404, 429) },
    },
  }, async (req, reply) => {
    const result = await loadSeries(db, req);
    const filename = result.indicator.id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}.csv"`)
      .header('X-Truncated', result.meta.truncated ? 'true' : 'false');
    return seriesToCsv(result);
  });
}
