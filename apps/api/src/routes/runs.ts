import type { FastifyInstance } from 'fastify';
import { listIngestionRuns, type Db } from '@h1n1/db';
import { parseOr400, runsQuery } from '../schemas.js';
import { RUNS_QUERY, RUNS_RESPONSE, errorResponses } from '../openapi.js';

export async function runsRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/runs', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['infra'],
      summary: 'Execuções de ingestão (ingestion_runs), mais recentes primeiro',
      description:
        'Transparência de operação: id, conector, fonte, início/fim, status, linhas lidas/gravadas e erro. O erro é ' +
        'truncado a 200 caracteres e nunca contém caminhos de disco; params da execução não são expostos. Cache 300 s + ETag.',
      querystring: RUNS_QUERY,
      response: { 200: RUNS_RESPONSE, ...errorResponses(400) },
    },
  }, async (req) => {
    const q = parseOr400(runsQuery, req.query);
    const filter: { sourceId?: string; limit?: number } = {};
    if (q.source_id) filter.sourceId = q.source_id;
    if (q.limit !== undefined) filter.limit = q.limit;
    return { data: await listIngestionRuns(opts.db, filter) };
  });
}
