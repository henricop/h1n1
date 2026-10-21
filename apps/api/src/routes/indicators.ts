import type { FastifyInstance } from 'fastify';
import { listIndicators, getIndicatorRow, getCurrentPublication, getFreshness, type Db } from '@h1n1/db';
import { parseOr400, indicatorsQuery } from '../schemas.js';
import { notFound } from '../errors.js';
import { ANY_OBJECT, INDICATORS_QUERY, errorResponses } from '../openapi.js';

export async function indicatorsRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get('/v1/indicators', {
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
    schema: {
      tags: ['indicadores'],
      summary: 'Definição de um indicador, publicação vigente e frescor',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      response: {
        200: {
          type: 'object',
          properties: { data: ANY_OBJECT, publication: { ...ANY_OBJECT, nullable: true }, freshness: { ...ANY_OBJECT, nullable: true } },
        },
        ...errorResponses(404),
      },
    },
  }, async (req) => {
    const data = await getIndicatorRow(db, req.params.id);
    if (!data) throw notFound(`Indicador não encontrado: ${req.params.id}`);
    const [publication, fresh] = await Promise.all([getCurrentPublication(db, data.id), getFreshness(db)]);
    const freshness = fresh.find((f) => f.indicator_id === data.id) ?? null;
    return { data, publication, freshness };
  });
}
