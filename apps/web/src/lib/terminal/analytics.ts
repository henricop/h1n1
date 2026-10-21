/**
 * Endpoints analíticos do CONTRATO_API 1.2 (seção 3.13) ainda não cobertos por src/lib/api.ts:
 *   /v1/map/brazil, /v1/analytics/ears, /v1/analytics/nowcast.
 * Mesma disciplina do cliente tipado: timeout, nunca lança, 404 → not_found, JSON validado por schema mínimo,
 * célula suprimida nunca carrega valor. Em modo mock (H1N1_API_MOCK=1) respondem not_found ("indisponível").
 * Servidor apenas (usa SITE.apiUrl).
 */
import { z } from 'zod';
import { API_TIMEOUT_MS, isMockMode, type ApiResult } from '@/lib/api';
import { SITE } from '@/lib/site';

const nullableString = z.string().nullable();

export const AnalyticsMetaSchema = z
  .object({
    data_as_of: nullableString.optional().default(null),
    universe_note: z.string().optional().default(''),
    license: nullableString.optional().default(null),
    source_id: z.string().optional().default(''),
    case_definition: z.string().optional().default(''),
    caveats: z.array(z.string()).optional().default([]),
  })
  .passthrough();
export type AnalyticsMeta = z.infer<typeof AnalyticsMetaSchema>;

const IndicatorRefSchema = z.object({ id: z.string(), name: z.string() }).passthrough();

export const MapBrazilSchema = z
  .object({
    indicator: IndicatorRefSchema,
    meta: AnalyticsMetaSchema,
    weeks: z.array(z.string()),
    states: z.array(
      z
        .object({
          code: z.string(),
          uf: z.string(),
          name: z.string(),
          values: z.array(z.number().nullable()),
          suppressed: z.array(z.boolean()),
        })
        .passthrough(),
    ),
    national: z.object({ values: z.array(z.number().nullable()), provisional: z.array(z.boolean()) }).passthrough().optional(),
  })
  .passthrough();
export type MapBrazil = z.infer<typeof MapBrazilSchema>;

export const EarsSchema = z
  .object({
    indicator: IndicatorRefSchema,
    meta: AnalyticsMetaSchema,
    method: z
      .object({
        name: z.string().optional().default('EARS C1/C2/C3'),
        baseline: z.number().optional(),
        guard: z.number().optional(),
        thresholds: z.object({ c1: z.number(), c2: z.number(), c3: z.number() }).passthrough().optional(),
        note: z.string().optional().default('sinal estatístico, não surto confirmado'),
      })
      .passthrough(),
    results: z.array(
      z
        .object({
          geo_code: z.string(),
          name: z.string().optional(),
          period: z.string(),
          value: z.number().nullable(),
          provisional: z.boolean().optional().default(false),
          c1: z.number().nullable(),
          c2: z.number().nullable(),
          c3: z.number().nullable(),
          flags: z.array(z.string()).default([]),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type EarsResult = z.infer<typeof EarsSchema>;

export const NowcastSchema = z
  .object({
    indicator: IndicatorRefSchema,
    meta: AnalyticsMetaSchema,
    delay: z.object({ period: z.string(), n: z.number(), cdf: z.array(z.number()), source_indicator: z.string().optional() }).passthrough().optional(),
    results: z.array(
      z
        .object({
          period: z.string(),
          weeks_ago: z.number(),
          observed: z.number().nullable(),
          reported_share: z.number().nullable(),
          estimated: z.number().nullable(),
          lower: z.number().nullable(),
          upper: z.number().nullable(),
        })
        .passthrough(),
    ),
    note: z.string().optional().default('Estimativa, não contagem.'),
  })
  .passthrough();
export type NowcastResult = z.infer<typeof NowcastSchema>;

function unavailable<T>(error: string, status: 'unavailable' | 'not_found' = 'unavailable'): ApiResult<T> {
  return { ok: false, status, error, attemptedAt: new Date().toISOString() };
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function request<T>(path: string, schema: z.ZodTypeAny): Promise<ApiResult<T>> {
  if (isMockMode()) return unavailable(`Endpoint sem fixture em modo mock: ${path}`, 'not_found');
  const url = `${SITE.apiUrl}${path}`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(API_TIMEOUT_MS), next: { revalidate: 300 } });
    if (res.status === 404) return unavailable(`Recurso não encontrado: ${path}`, 'not_found');
    if (!res.ok) return unavailable(`API respondeu ${res.status} em ${path}`);
    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`).join('; ');
      console.error(`[analytics] Contrato inválido em ${path}: ${issues}`);
      return unavailable(`Contrato inválido da API em ${path}: ${issues}`);
    }
    return { ok: true, data: parsed.data as T, fetchedAt: new Date().toISOString() };
  } catch (err) {
    return unavailable(`Falha ao acessar ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Célula suprimida nunca carrega valor, independentemente do que a API devolveu. */
function normalizeMap(m: MapBrazil): MapBrazil {
  return { ...m, states: m.states.map((s) => ({ ...s, values: s.values.map((v, i) => (s.suppressed[i] ? null : v)) })) };
}

export function getMapBrazil(indicator: string, opts: { from?: string; to?: string } = {}): Promise<ApiResult<MapBrazil>> {
  return request<MapBrazil>(`/v1/map/brazil${query({ indicator, from: opts.from, to: opts.to })}`, MapBrazilSchema).then((r) => (r.ok ? { ...r, data: normalizeMap(r.data) } : r));
}

export interface EarsParams {
  indicator: string;
  geo_level?: 'state' | 'country';
  geo_code?: string;
  weeks?: number;
}

export function getEars(p: EarsParams): Promise<ApiResult<EarsResult>> {
  return request<EarsResult>(`/v1/analytics/ears${query({ indicator: p.indicator, geo_level: p.geo_level, geo_code: p.geo_code, weeks: p.weeks })}`, EarsSchema);
}

export function getNowcast(indicator: string, geo_code = 'BRA', weeks?: number): Promise<ApiResult<NowcastResult>> {
  return request<NowcastResult>(`/v1/analytics/nowcast${query({ indicator, geo_code, weeks })}`, NowcastSchema);
}
