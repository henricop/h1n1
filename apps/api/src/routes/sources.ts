import type { FastifyInstance } from 'fastify';
import { listSources, getSource, listIndicators, type Db } from '@h1n1/db';
import { parseOr400, sourcesQuery } from '../schemas.js';
import { notFound } from '../errors.js';
import { ANY_OBJECT, SOURCES_QUERY, errorResponses } from '../openapi.js';

export async function sourcesRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get('/v1/sources', {
    schema: {
      tags: ['fontes'],
      summary: 'Lista o catálogo de fontes oficiais (65)',
      querystring: SOURCES_QUERY,
      response: {
        200: { type: 'object', properties: { data: { type: 'array', items: ANY_OBJECT }, count: { type: 'integer' } } },
        ...errorResponses(400),
      },
    },
  }, async (req) => {
    const q = parseOr400(sourcesQuery, req.query);
    const filter: { priority?: string; country?: string; accessType?: string } = {};
    if (q.priority) filter.priority = q.priority;
    if (q.country) filter.country = q.country;
    if (q.access_type) filter.accessType = q.access_type;
    const data = await listSources(db, filter);
    return { data, count: data.length };
  });

  app.get<{ Params: { idOrSlug: string } }>('/v1/sources/:idOrSlug', {
    schema: {
      tags: ['fontes'],
      summary: 'Uma fonte por id (BR-03) ou slug (br_sivep_gripe), com seus indicadores',
      params: { type: 'object', properties: { idOrSlug: { type: 'string' } }, required: ['idOrSlug'] },
      response: {
        200: { type: 'object', properties: { data: ANY_OBJECT, indicators: { type: 'array', items: ANY_OBJECT } } },
        ...errorResponses(404),
      },
    },
  }, async (req) => {
    const source = await getSource(db, req.params.idOrSlug);
    if (!source) throw notFound(`Fonte não encontrada: ${req.params.idOrSlug}`);
    const indicators = await listIndicators(db, { sourceId: source.id });
    return { data: source, indicators };
  });
}
