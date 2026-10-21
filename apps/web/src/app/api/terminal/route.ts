/**
 * POST /api/terminal { line } → CommandOutput. Executa o comando no servidor com o cliente tipado da API.
 * Sem persistência; linha limitada a 300 caracteres; rate limit por IP; sem detalhes internos na resposta.
 * Lógica em src/lib/terminal/route-handler.ts (testada).
 */
import { handleTerminal } from '@/lib/terminal/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: Request): Promise<Response> {
  return handleTerminal(req);
}
