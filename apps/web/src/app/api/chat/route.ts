/**
 * /api/chat — assistente "Pergunte ao observatório".
 * GET: estado (200 enabled / 503 assistant_disabled). POST: streaming (UI message stream do Vercel AI SDK).
 * Node runtime (lê content/ e usa o cliente tipado da API). Sem persistência; sem coleta de dados pessoais.
 */
import { handleChatRequest, handleChatStatus } from '@/lib/assistant/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export function GET(): Response {
  return handleChatStatus();
}

export function POST(req: Request): Promise<Response> {
  return handleChatRequest(req);
}
