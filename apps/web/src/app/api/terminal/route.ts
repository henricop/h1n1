/**
 * POST /api/terminal { line } → CommandOutput. Executa o comando no servidor com o cliente tipado da API.
 * Sem persistência; linha limitada a 300 caracteres.
 */
import { executeLine } from '@/lib/terminal/execute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LINE = 300;

export async function POST(req: Request): Promise<Response> {
  let line = '';
  try {
    const body = (await req.json()) as { line?: unknown };
    line = typeof body.line === 'string' ? body.line : '';
  } catch {
    return Response.json({ blocks: [{ kind: 'error', lines: ['Requisição inválida: envie JSON { "line": "..." }.'] }] }, { status: 400 });
  }
  if (line.length > MAX_LINE) {
    return Response.json({ blocks: [{ kind: 'error', lines: [`Linha longa demais (máximo ${MAX_LINE} caracteres).`] }] }, { status: 400 });
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(line)) {
    return Response.json({ blocks: [{ kind: 'error', lines: ['Linha contém caracteres de controle.'] }] }, { status: 400 });
  }
  const out = await executeLine(line);
  return Response.json(out, { headers: { 'cache-control': 'no-store' } });
}
