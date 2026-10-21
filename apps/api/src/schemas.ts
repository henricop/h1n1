import { z } from 'zod';
import { badRequest } from './errors.js';

/** Converte falha do zod em 400 { error: { code: 'validation_error' } } com mensagem legível. */
export function parseOr400<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const msg = r.error.issues
    .map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`)
    .join('; ');
  throw badRequest(msg);
}

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const period = z
  .string()
  .regex(/^\d{4}(-(W|M)\d{2})?$/, 'período deve ter o formato AAAA, AAAA-Www ou AAAA-Mmm (ex. 2025-W01)');

const uuid = z.string().uuid('deve ser um UUID de snapshot');

export const geoLevelEnum = z.enum(['world', 'country', 'region', 'state']);

export const sourcesQuery = z.object({
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  country: z.string().min(1).max(8).optional(),
  access_type: z.enum(['api', 'open_data', 'portal']).optional(),
});

export const indicatorsQuery = z.object({
  source_id: z.string().min(1).max(32).optional(),
});

export const seriesQueryBase = z.object({
  indicator: z.string({ error: 'parâmetro obrigatório' }).min(1, 'parâmetro obrigatório'),
  geo_level: geoLevelEnum.optional(),
  geo_code: z.string().min(1).max(16).optional(),
  from: period.optional(),
  to: period.optional(),
  include_strata: bool.optional(),
  limit: z.coerce.number().int().min(1).max(100000).optional(),
});

export interface SeriesParams {
  indicator: string;
  geoLevel?: z.infer<typeof geoLevelEnum>;
  geoCode?: string;
  from?: string;
  to?: string;
  includeStrata?: boolean;
  limit?: number;
  stratum?: Record<string, string>;
}

const STRATUM_DIM = /^[a-z][a-z0-9_]{0,31}$/;

/** Lê a query de /v1/series, incluindo stratum.<dim>=<valor>. */
export function parseSeriesQuery(raw: Record<string, unknown>): SeriesParams {
  const base = parseOr400(seriesQueryBase, raw);
  const stratum: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('stratum.')) continue;
    const dim = k.slice('stratum.'.length);
    if (!STRATUM_DIM.test(dim)) throw badRequest(`${k}: dimensão de estrato inválida`);
    if (typeof v !== 'string' || !v.length || v.length > 64) throw badRequest(`${k}: valor de estrato inválido`);
    stratum[dim] = v;
  }
  const out: SeriesParams = { indicator: base.indicator };
  if (base.geo_level) out.geoLevel = base.geo_level;
  if (base.geo_code) out.geoCode = base.geo_code;
  if (base.from) out.from = base.from;
  if (base.to) out.to = base.to;
  if (base.include_strata !== undefined) out.includeStrata = base.include_strata;
  if (base.limit !== undefined) out.limit = base.limit;
  if (Object.keys(stratum).length) out.stratum = stratum;
  return out;
}

export const snapshotsQuery = z.object({
  source_id: z.string().min(1).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const diffQuery = z.object({
  indicator: z.string({ error: 'parâmetro obrigatório' }).min(1, 'parâmetro obrigatório'),
  a: uuid,
  b: uuid,
  limit: z.coerce.number().int().min(1).max(100000).optional(),
});

export const geoQuery = z.object({
  level: geoLevelEnum.optional(),
});

export const isUuid = (s: string) => uuid.safeParse(s).success;
