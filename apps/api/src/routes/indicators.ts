import type { FastifyInstance } from 'fastify';
import { listIndicators, getIndicatorRow, getCurrentPublication, getFreshness, getSeries } from '@h1n1/db';
import { trend } from '@h1n1/analytics';
import { parseOr400, indicatorsQuery, pathId, latestQuery, inferGeoLevel } from '../schemas.js';
import { notFound, badRequest } from '../errors.js';
import { ANY_OBJECT, INDICATORS_QUERY, LATEST_QUERY, LATEST_RESPONSE, errorResponses } from '../openapi.js';
import { vizMeta, indicatorRef, requireComplete, type VizRouteOptions } from './viz.js';

/** Janela (em períodos) da variação exibida nos contadores do HUD. */
export const LATEST_TREND_K = 4;

export async function indicatorsRoutes(app: FastifyInstance, opts: VizRouteOptions) {
  const { db } = opts;
  const limit = opts.rowLimit ?? 100000;

  app.get('/v1/indicators', {
    config: { cache: 'catalog' },
    schema: {
      tags: ['indicadores'],
      summary: 'Lista a ontologia de indicadores (H1N1 confirmado ≠ influenza A ≠ SRAG)',
      querystring: INDICATORS_QUERY,
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: ANY_OBJECT } } }, ...errorResponses(400) },
    },
  }, async (req) => {
    const q = parseOr400(indicatorsQuery, req.query);
    const filter: { sourceId?: string } = {};
    if (q.source_id) filter.sourceId = q.source_id;
    return { data: await listIndicators(db, filter) };
  });

  app.get<{ Params: { id: string } }>('/v1/indicators/:id', {
    config: { cache: 'catalog' },
    schema: {
      tags: ['indicadores'],
      summary: 'Definição de um indicador, publicação vigente e frescor',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      response: {
        200: {
          type: 'object',
          properties: { data: ANY_OBJECT, publication: { ...ANY_OBJECT, nullable: true }, freshness: { ...ANY_OBJECT, nullable: true } },
        },
        ...errorResponses(400, 404),
      },
    },
  }, async (req) => {
    const id = parseOr400(pathId, req.params.id);
    const data = await getIndicatorRow(db, id);
    if (!data) throw notFound(`Indicador não encontrado: ${id}`);
    const [publication, fresh] = await Promise.all([getCurrentPublication(db, data.id), getFreshness(db)]);
    const freshness = fresh.find((f) => f.indicator_id === data.id) ?? null;
    return { data, publication, freshness };
  });

  app.get<{ Params: { id: string } }>('/v1/indicators/:id/latest', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['indicadores'],
      summary: 'Último período publicado com valor (contadores do HUD) e variação vs as 4 semanas anteriores',
      description:
        'Percorre a série total (sem estrato) da geo e devolve o último período com valor não suprimido, se é provisório e a ' +
        'variação percentual entre a média das últimas 4 semanas e a das 4 anteriores (null se insuficiente). Sem publicação ' +
        'vigente ou sem valor: latest null. 400 se o nível inferido de geo_code não consta em geo_levels do indicador; ' +
        '400 too_many_rows se a série exceder o limite de linhas. Cache 300 s + ETag.',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      querystring: LATEST_QUERY,
      response: { 200: LATEST_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req) => {
    const id = parseOr400(pathId, req.params.id);
    const q = parseOr400(latestQuery, req.query);
    const indicator = await getIndicatorRow(db, id);
    if (!indicator) throw notFound(`Indicador não encontrado: ${id}`);
    const geoCode = q.geo_code ?? 'BRA';
    const geoLevel = inferGeoLevel(geoCode);
    if (!indicator.geo_levels.includes(geoLevel)) {
      throw badRequest(`geo_code: ${geoCode} é do nível ${geoLevel}, que o indicador ${indicator.id} não publica (geo_levels: ${indicator.geo_levels.join(', ')})`);
    }
    const r = await getSeries(db, { indicator: indicator.id, geoLevel, geoCode, limit });
    if (!r) throw notFound(`Indicador não encontrado: ${id}`);
    requireComplete(r, 'latest');
    const obs = [...r.observations].sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    let idx = -1;
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i]!;
      if (!o.suppressed && o.value !== null) { idx = i; break; }
    }
    const values = obs.slice(0, idx + 1).map((o) => (o.suppressed ? null : o.value));
    const mean = (xs: (number | null)[]): number | null => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    const k = LATEST_TREND_K;
    const latest = idx >= 0 ? obs[idx]! : null;
    return {
      indicator: indicatorRef(indicator),
      meta: vizMeta(r),
      geo_code: geoCode,
      latest: latest
        ? {
            period: latest.period, period_start: latest.period_start, period_end: latest.period_end, value: latest.value,
            provisional: latest.update_status === 'provisional', update_status: latest.update_status,
          }
        : null,
      trend: {
        k,
        change_pct: trend(values, k),
        recent_mean: values.length >= 2 * k ? mean(values.slice(-k)) : null,
        previous_mean: values.length >= 2 * k ? mean(values.slice(-2 * k, -k)) : null,
      },
    };
  });
}
