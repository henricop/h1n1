/**
 * Handler de POST /api/terminal (testável fora do Next): rate limit por IP, validação da linha e
 * sanitização da saída (detalhes internos só no log do servidor; achado c).
 */
import { executeLine } from './execute';
import type { CommandOutput } from './format';
import { clientIp, terminalRateLimiter, type MemoryRateLimiter } from '@/lib/assistant/rate-limit';

export const MAX_LINE = 300;
const DETAIL_RE = /^detalhe:/i;

/** Remove linhas "detalhe: …" dos blocos de erro/aviso (contêm URL interna e mensagens do fetch) e as registra no servidor. */
export function sanitizeOutput(out: CommandOutput, line: string, log: (msg: string) => void = (m) => console.error(m)): CommandOutput {
  const blocks = out.blocks.map((b) => {
    if (b.kind !== 'error' && b.kind !== 'warn') return b;
    const kept = b.lines.filter((l) => {
      if (!DETAIL_RE.test(l.trim())) return true;
      log(`[terminal] ${line.slice(0, 80)} → ${l}`);
      return false;
    });
    return { ...b, lines: kept };
  });
  return { ...out, blocks };
}

export interface TerminalRouteOptions {
  env?: Record<string, string | undefined>;
  limiter?: MemoryRateLimiter;
  now?: () => number;
  exec?: (line: string) => Promise<CommandOutput>;
}

export async function handleTerminal(req: Request, opts: TerminalRouteOptions = {}): Promise<Response> {
  const limiter = opts.limiter ?? terminalRateLimiter;
  const decision = limiter.check(clientIp(req, opts.env ?? process.env), (opts.now ?? Date.now)());
  if (!decision.allowed) {
    return Response.json(
      { blocks: [{ kind: 'error', lines: [`Muitos comandos em pouco tempo. Tente novamente em ${decision.retryAfterSec} s.`] }] },
      { status: 429, headers: { 'retry-after': String(decision.retryAfterSec), 'cache-control': 'no-store' } },
    );
  }
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
  const out = await (opts.exec ?? executeLine)(line);
  return Response.json(sanitizeOutput(out, line), { headers: { 'cache-control': 'no-store' } });
}

