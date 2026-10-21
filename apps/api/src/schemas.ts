import { z } from 'zod';
import { BR_STATE_BY_UF } from '@h1n1/core';
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

/** Tamanho máximo de qualquer parâmetro textual (query ou path). */
export const TEXT_MAX = 200;
/** Caracteres de controle C0 (inclui \u0000), DEL e C1 são rejeitados em todo parâmetro de texto. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Texto seguro: sem caracteres de controle e com no máximo 200 caracteres.
 * Use como base de todo parâmetro textual; `max` refina o teto por campo.
 */
export const safeText = (max: number = TEXT_MAX) =>
  z
    .string()
    .max(Math.min(max, TEXT_MAX), `máximo de ${Math.min(max, TEXT_MAX)} caracteres`)
    .refine((v) => !CONTROL_CHARS.test(v), 'não pode conter caracteres de controle');

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

export const PERIOD_RE = /^\d{4}(-(W\d{2}|M\d{2}))?$/;
export const period = safeText(8).refine(
  (v) => PERIOD_RE.test(v),
  'período deve ter o formato AAAA, AAAA-Www ou AAAA-Mnn (ex. 2025-W01)',
);

const uuid = safeText(36).refine((v) => z.string().uuid().safeParse(v).success, 'deve ser um UUID de snapshot');

export const geoLevelEnum = z.enum(['world', 'country', 'region', 'state']);

const nonEmpty = (max: number) => safeText(max).refine((v) => v.length > 0, 'não pode ser vazio');

export const sourcesQuery = z.object({
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  country: nonEmpty(8).optional(),
  access_type: z.enum(['api', 'open_data', 'portal']).optional(),
});

export const indicatorsQuery = z.object({
  source_id: nonEmpty(32).optional(),
});

const indicatorId = z
  .string({ error: 'parâmetro obrigatório' })
  .pipe(nonEmpty(64));

export const seriesQueryBase = z.object({
  indicator: indicatorId,
  geo_level: geoLevelEnum.optional(),
  geo_code: nonEmpty(16).optional(),
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
const STRATUM_VALUE = safeText(64)
  .refine((v) => v.length > 0, 'não pode ser vazio')
  .refine((v) => !v.includes(';') && !v.includes('='), "não pode conter ';' nem '='");

/** Lê a query de /v1/series, incluindo stratum.<dim>=<valor>. */
export function parseSeriesQuery(raw: Record<string, unknown>): SeriesParams {
  const base = parseOr400(seriesQueryBase, raw);
  const stratum: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('stratum.')) continue;
    const dim = k.slice('stratum.'.length);
    if (!STRATUM_DIM.test(dim)) throw badRequest(`${k}: dimensão de estrato inválida`);
    if (typeof v !== 'string') throw badRequest(`${k}: valor de estrato inválido`);
    const parsed = STRATUM_VALUE.safeParse(v);
    if (!parsed.success) throw badRequest(`${k}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    stratum[dim] = parsed.data;
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

export type PeriodType = 'epiweek' | 'isoweek' | 'month' | 'year';

/**
 * Normaliza um limite de período `AAAA` para o primeiro (`from`) ou último (`to`) período do ano,
 * conforme o `period_type` do indicador: AAAA-W01/AAAA-W53, AAAA-M01/AAAA-M12 ou AAAA.
 * Valores já no formato AAAA-Www / AAAA-Mnn são devolvidos como estão.
 */
export function normalizePeriodBound(value: string, periodType: PeriodType, bound: 'from' | 'to'): string {
  if (!/^\d{4}$/.test(value)) return value;
  switch (periodType) {
    case 'epiweek':
    case 'isoweek':
      return bound === 'from' ? `${value}-W01` : `${value}-W53`;
    case 'month':
      return bound === 'from' ? `${value}-M01` : `${value}-M12`;
    default:
      return value;
  }
}

/** Normaliza from/to e rejeita intervalo invertido (from > to) com 400. */
export function normalizePeriodRange(
  from: string | undefined,
  to: string | undefined,
  periodType: PeriodType,
): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  if (from) out.from = normalizePeriodBound(from, periodType, 'from');
  if (to) out.to = normalizePeriodBound(to, periodType, 'to');
  if (out.from && out.to && out.from > out.to) {
    throw badRequest(`from: não pode ser posterior a to (${out.from} > ${out.to})`);
  }
  return out;
}

export const snapshotsQuery = z.object({
  source_id: nonEmpty(32).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const diffQuery = z.object({
  indicator: indicatorId,
  a: uuid,
  b: uuid,
  limit: z.coerce.number().int().min(1).max(100000).optional(),
});

export const geoQuery = z.object({
  level: geoLevelEnum.optional(),
});

/** Parâmetro de caminho textual (ids e slugs): sem caracteres de controle, 1–200 caracteres. */
export const pathId = nonEmpty(TEXT_MAX);

export const isUuid = (s: string) => uuid.safeParse(s).success;

// ---------------------------------------------------------------------------------------------------------
// Visualização e análise (CONTRATO_API.md §3.13)
// ---------------------------------------------------------------------------------------------------------

const geoCode = nonEmpty(16);

export const globeQuery = z.object({
  indicator: indicatorId,
  from: period.optional(),
  to: period.optional(),
  origin: z.enum(['all', 'SENTINEL', 'NONSENTINEL', 'NOTDEFINED']).optional(),
});

export const mapBrazilQuery = z.object({
  indicator: indicatorId,
  from: period.optional(),
  to: period.optional(),
});

export const earsQuery = z.object({
  indicator: indicatorId,
  geo_level: z.enum(['state', 'country']).optional(),
  geo_code: geoCode.optional(),
  weeks: z.coerce.number().int().min(1).max(52).optional(),
  baseline: z.coerce.number().int().min(2).max(52).optional(),
  guard: z.coerce.number().int().min(0).max(8).optional(),
});

export const nowcastQuery = z.object({
  indicator: indicatorId,
  geo_code: geoCode.optional(),
  weeks: z.coerce.number().int().min(1).max(13).optional(),
});

export const seasonsQuery = z.object({
  indicator: indicatorId,
  geo_code: geoCode.optional(),
  from_year: z.coerce.number().int().min(1990).max(2100).optional(),
});

export const runsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  source_id: nonEmpty(32).optional(),
});

export const latestQuery = z.object({
  geo_code: geoCode.optional(),
});

/**
 * Nível geográfico inferido do código: WLD → world; BR-<UF> → state; BR-N/NE/S/CO → region; demais → country.
 * Regiões usam o prefixo BR-R- (BR-R-SE = Sudeste); BR-SE é a UF Sergipe.
 */
export function inferGeoLevel(code: string): z.infer<typeof geoLevelEnum> {
  if (code === 'WLD') return 'world';
  if (/^BR-R-(N|NE|SE|S|CO)$/.test(code)) return 'region';
  const m = /^BR-([A-Z]{2})$/.exec(code);
  if (m && BR_STATE_BY_UF.has(m[1]!)) return 'state';
  return 'country';
}
