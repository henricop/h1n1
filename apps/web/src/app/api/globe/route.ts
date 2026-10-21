/**
 * GET /api/globe?indicator=…&from=AAAA-Www → GlobeResult completo (proxy de /v1/globe via src/lib/api.ts, com cache de 1 h).
 * Usado pela sala de dados para carregar o histórico sob demanda (o RSC envia só as últimas semanas).
 */
import { getGlobe } from '@/lib/api';

export const runtime = 'nodejs';

const SAFE_ID = /^[a-z0-9_]+$/;
const WEEK = /^\d{4}-W\d{2}$/;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const indicator = url.searchParams.get('indicator') ?? '';
  const from = url.searchParams.get('from') ?? undefined;
  if (!SAFE_ID.test(indicator) || (from && !WEEK.test(from))) {
    return Response.json({ error: { code: 'validation_error', message: 'parâmetros inválidos' } }, { status: 400 });
  }
  const r = await getGlobe({ indicator, from });
  if (!r.ok) return Response.json({ error: { code: r.status, message: 'dado indisponível no momento' } }, { status: r.status === 'not_found' ? 404 : 503, headers: { 'cache-control': 'no-store' } });
  return Response.json(r.data, { headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } });
}
