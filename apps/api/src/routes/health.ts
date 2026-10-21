import type { FastifyInstance } from 'fastify';
import type { Db } from '@h1n1/db';

const HEALTH_SCHEMA = {
  type: 'object',
  properties: { status: { type: 'string' }, db: { type: 'string', enum: ['pglite', 'pg'] }, time: { type: 'string' } },
} as const;

export async function healthRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/health', {
    schema: {
      tags: ['infra'],
      summary: 'Estado do serviço e do banco',
      response: {
        200: HEALTH_SCHEMA,
        503: HEALTH_SCHEMA,
      },
    },
  }, async (_req, reply) => {
    const time = new Date().toISOString();
    try {
      await opts.db.query('select 1');
      return { status: 'ok', db: opts.db.kind, time };
    } catch {
      reply.code(503);
      return { status: 'error', db: opts.db.kind, time };
    }
  });
}
