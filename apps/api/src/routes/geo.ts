import type { FastifyInstance } from 'fastify';
import type { Db } from '@h1n1/db';
import { parseOr400, geoQuery } from '../schemas.js';
import { ANY_OBJECT, GEO_QUERY, errorResponses } from '../openapi.js';

export interface GeoRow {
  code: string; level: string; name: string; parent_code: string | null; ibge_id: string | null; iso2: string | null;
}

export async function geoRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/geo', {
    config: { cache: 'catalog' },
    schema: {
      tags: ['geo'],
      summary: 'Unidades geográficas (mundo, países, regiões e UFs do Brasil)',
      querystring: GEO_QUERY,
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: ANY_OBJECT } } }, ...errorResponses(400) },
    },
  }, async (req) => {
    const q = parseOr400(geoQuery, req.query);
    const params: unknown[] = [];
    let sql = 'select code, level, name, parent_code, ibge_id, iso2 from geo';
    if (q.level) { params.push(q.level); sql += ' where level = $1'; }
    sql += ' order by level, code';
    return { data: (await opts.db.query<GeoRow>(sql, params)).rows };
  });
}
