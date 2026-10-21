import type { FastifyInstance } from 'fastify';
import { getFreshness, type Db } from '@h1n1/db';
import { ANY_OBJECT } from '../openapi.js';

export async function freshnessRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/freshness', {
    schema: {
      tags: ['infra'],
      summary: 'Frescor por indicador: snapshot vigente, data_as_of, idade em dias, última ingestão',
      response: {
        200: { type: 'object', properties: { data: { type: 'array', items: ANY_OBJECT }, generated_at: { type: 'string' } } },
      },
    },
  }, async () => ({ data: await getFreshness(opts.db), generated_at: new Date().toISOString() }));
}
