import type { FastifyInstance } from 'fastify';
import type { Snapshot } from '@h1n1/core';
import { listSnapshots, getSnapshot, getIndicatorRow, diffSnapshots, type Db } from '@h1n1/db';
import { parseOr400, snapshotsQuery, diffQuery, isUuid, pathId } from '../schemas.js';
import { notFound, badRequest } from '../errors.js';
import { ANY_OBJECT, SNAPSHOTS_QUERY, DIFF_QUERY, SNAPSHOT_SCHEMA, errorResponses } from '../openapi.js';

/** Snapshot sem campos operacionais internos (storage_path nunca sai em respostas públicas). */
export type PublicSnapshot = Omit<Snapshot, 'storage_path'>;

export function publicSnapshot(s: Snapshot): PublicSnapshot {
  const { storage_path: _omit, ...rest } = s;
  void _omit;
  return rest;
}

export async function snapshotsRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  app.get('/v1/snapshots', {
    config: { cache: 'snapshots' },
    schema: {
      tags: ['snapshots'],
      summary: 'Snapshots imutáveis baixadas das fontes (sha256, url, fetched_at, licença)',
      description: 'Inclui snapshots com status ok, failed e quarantined (transparência de operação). storage_path não é exposto.',
      querystring: SNAPSHOTS_QUERY,
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: SNAPSHOT_SCHEMA } } }, ...errorResponses(400) },
    },
  }, async (req) => {
    const q = parseOr400(snapshotsQuery, req.query);
    const filter: { sourceId?: string; limit?: number } = {};
    if (q.source_id) filter.sourceId = q.source_id;
    if (q.limit !== undefined) filter.limit = q.limit;
    return { data: (await listSnapshots(db, filter)).map(publicSnapshot) };
  });

  app.get<{ Params: { id: string } }>('/v1/snapshots/:id', {
    config: { cache: 'snapshots' },
    schema: {
      tags: ['snapshots'],
      summary: 'Uma snapshot por id',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
      response: { 200: { type: 'object', properties: { data: SNAPSHOT_SCHEMA } }, ...errorResponses(400, 404) },
    },
  }, async (req) => {
    const id = parseOr400(pathId, req.params.id);
    const snap = isUuid(id) ? await getSnapshot(db, id) : null;
    if (!snap) throw notFound(`Snapshot não encontrada: ${id}`);
    return { data: publicSnapshot(snap) };
  });

  app.get('/v1/diff', {
    config: { cache: 'snapshots' },
    schema: {
      tags: ['snapshots'],
      summary: 'Diferenças célula a célula entre duas snapshots do mesmo indicador (revisões retrospectivas)',
      description:
        'Restrições desta versão: apenas snapshots com status = ok (400 caso contrário; 404 se não existirem) e da fonte do ' +
        'indicador; o resultado é restrito a geo_level = country com stratum_key = \'\' (total nacional). Células subnacionais ' +
        'ou estratificadas nunca saem do diff, para que ele não sirva de canal de reconstrução de células suprimidas.',
      querystring: DIFF_QUERY,
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: ANY_OBJECT } } }, ...errorResponses(400, 404) },
    },
  }, async (req) => {
    const q = parseOr400(diffQuery, req.query);
    const ind = await getIndicatorRow(db, q.indicator);
    if (!ind) throw notFound(`Indicador não encontrado: ${q.indicator}`);
    const [a, b] = await Promise.all([getSnapshot(db, q.a), getSnapshot(db, q.b)]);
    for (const [label, snap] of [['a', a], ['b', b]] as const) {
      if (!snap) throw notFound(`Snapshot ${label} não encontrada: ${label === 'a' ? q.a : q.b}`);
      if (snap.status !== 'ok') {
        throw badRequest(`${label}: só snapshots com status 'ok' podem ser comparadas (status atual: '${snap.status}')`);
      }
      if (snap.source_id !== ind.source_id) {
        throw badRequest(`${label}: snapshot pertence à fonte ${snap.source_id}, mas o indicador ${ind.id} é da fonte ${ind.source_id}`);
      }
    }
    return { data: await diffSnapshots(db, q.indicator, q.a, q.b, q.limit) };
  });
}
