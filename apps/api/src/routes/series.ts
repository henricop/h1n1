import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getSeries, type Db, type SeriesQuery } from '@h1n1/db';
import { parseSeriesQuery } from '../schemas.js';
import { notFound } from '../errors.js';
import { seriesToCsv } from '../csv.js';
import { SERIES_QUERY, SERIES_RESPONSE, errorResponses } from '../openapi.js';

async function loadSeries(db: Db, req: FastifyRequest) {
  const p = parseSeriesQuery((req.query ?? {}) as Record<string, unknown>);
  const q: SeriesQuery = { indicator: p.indicator };
  if (p.geoLevel) q.geoLevel = p.geoLevel;
  if (p.geoCode) q.geoCode = p.geoCode;
  if (p.from) q.from = p.from;
  if (p.to) q.to = p.to;
  if (p.includeStrata !== undefined) q.includeStrata = p.includeStrata;
  if (p.limit !== undefined) q.limit = p.limit;
  if (p.stratum) q.stratum = p.stratum;
  const result = await getSeries(db, q);
  if (!result) throw notFound(`Indicador não encontrado: ${p.indicator}`);
  return result;
}

export async function seriesRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get('/v1/series', {
    schema: {
      tags: ['séries'],
      summary: 'Série temporal publicada de um indicador (snapshot vigente, supressão aplicada)',
      description:
        'Devolve exclusivamente observações da snapshot vigente do indicador. Sem publicação vigente, responde 200 com ' +
        'observations vazio e meta.data_as_of null — nunca inventa dado. Exiba meta.universe_note junto a qualquer número.',
      querystring: SERIES_QUERY,
      response: { 200: SERIES_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req) => loadSeries(db, req));

  app.get('/v1/series.csv', {
    schema: {
      tags: ['séries'],
      summary: 'Mesma série em CSV (download)',
      description:
        'Colunas: indicator_id,geo_level,geo_code,period_type,period,period_start,period_end,value,denominator,suppressed,' +
        'update_status,stratum_key,quality_flags,snapshot_id,data_as_of,source_id,license. Células suprimidas saem com value vazio e suppressed=true.',
      querystring: SERIES_QUERY,
      produces: ['text/csv'],
      response: { 200: { type: 'string', description: 'CSV' }, ...errorResponses(400, 404) },
    },
  }, async (req, reply) => {
    const result = await loadSeries(db, req);
    const filename = result.indicator.id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return seriesToCsv(result);
  });
}
