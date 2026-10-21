import type { FastifyInstance } from 'fastify';
import { listSnapshots, getSnapshot, getIndicatorRow, diffSnapshots, type Db } from '@h1n1/db';
import { parseOr400, snapshotsQuery, diffQuery, isUuid } from '../schemas.js';
import { notFound } from '../errors.js';
import { ANY_OBJECT, SNAPSHOTS_QUERY, DIFF_QUERY, errorResponses } from '../openapi.js';

export async function snapshotsRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get('/v1/snapshots', {
    schema: {
      tags: ['snapshots'],
      summary: 'Snapshots imutáveis baixadas das fontes (sha256, url, fetched_at, licença)',
      querystring: SNAPSHOTS_QUERY,
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: ANY_OBJECT } } }, ...errorResponses(400) },
    },
  }, async (req) => {
    const q = parseOr400(snapshotsQuery, req.query);
    const filter: { sourceId?: string; limit?: number } = {};
    if (q.source_id) filter.sourceId = q.source_id;
    if (q.limit !== undefined) filter.limit = q.limit;
    return { data: await listSnapshots(db, filter) };
  });

  app.get<{ Params: { id: string } }>('/v1/snapshots/:id', {
    schema: {
      tags: ['snapshots'],
      summary: 'Uma snapshot por id',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
      response: { 200: { type: 'object', properties: { data: ANY_OBJECT } }, ...errorResponses(404) },
    },
  }, async (req) => {
    const id = req.params.id;
    const snap = isUuid(id) ? await getSnapshot(db, id) : null;
    if (!snap) throw notFound(`Snapshot não encontrada: ${id}`);
    return { data: snap };
  });

  app.get('/v1/diff', {
    schema: {
      tags: ['snapshots'],
      summary: 'Diferenças célula a célula entre duas snapshots do mesmo indicador (revisões retrospectivas)',
      querystring: DIFF_QUERY,
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: ANY_OBJECT } } }, ...errorResponses(400, 404) },
    },
  }, async (req) => {
    const q = parseOr400(diffQuery, req.query);
    const ind = await getIndicatorRow(db, q.indicator);
    if (!ind) throw notFound(`Indicador não encontrado: ${q.indicator}`);
    return { data: await diffSnapshots(db, q.indicator, q.a, q.b, q.limit) };
  });
}
