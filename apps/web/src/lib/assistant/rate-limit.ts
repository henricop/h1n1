/**
 * Rate limit em memória por chave (janela deslizante). Chaves ficam só em memória, nunca persistidas (LGPD).
 * Padrão do assistente: 20 requisições por 10 minutos.
 *
 * Limites: o contador é POR INSTÂNCIA do processo Node (sem Redis). Com várias réplicas, cada uma conta
 * separadamente; o limite efetivo é `max × réplicas`. Para limite global, troque por um armazenamento compartilhado.
 */

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = { max: 20, windowMs: 10 * 60 * 1000 };
/** Terminal: consultas baratas à API, mas sem persistência; 60 por 10 minutos por IP. */
export const TERMINAL_RATE_LIMIT: RateLimitOptions = { max: 60, windowMs: 10 * 60 * 1000 };

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** Segundos até liberar uma nova requisição (0 quando permitido). */
  retryAfterSec: number;
}

export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly opts: RateLimitOptions = DEFAULT_RATE_LIMIT) {}

  check(key: string, now: number = Date.now()): RateLimitDecision {
    const since = now - this.opts.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length >= this.opts.max) {
      const oldest = list[0]!;
      this.hits.set(key, list);
      return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((oldest + this.opts.windowMs - now) / 1000)) };
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.sweep(since);
    return { allowed: true, remaining: this.opts.max - list.length, retryAfterSec: 0 };
  }

  private sweep(since: number): void {
    for (const [k, v] of this.hits) {
      const kept = v.filter((t) => t > since);
      if (kept.length === 0) this.hits.delete(k);
      else this.hits.set(k, kept);
    }
  }

  reset(): void {
    this.hits.clear();
  }
}

/** Chave usada quando não há proxy confiável: o Next não expõe o socket, então todos dividem um balde. */
export const DIRECT_CLIENT_KEY = 'direct';

/**
 * IP do cliente para o rate limit.
 * - `TRUST_PROXY=true` (atrás de um proxy reverso que sobrescreve o header): ÚLTIMO valor de `x-forwarded-for`
 *   (o único acrescentado pelo proxy e, portanto, não forjável pelo cliente), senão `x-real-ip`.
 * - Caso contrário o header é IGNORADO (qualquer cliente poderia forjá-lo para escapar do limite) e usa-se a chave fixa
 *   `direct`: sem proxy, o Next não expõe o IP do socket. Em produção atrás de proxy, defina TRUST_PROXY=true.
 */
export function clientIp(req: Request, env: Record<string, string | undefined> = process.env): string {
  if (env.TRUST_PROXY?.trim().toLowerCase() !== 'true') return DIRECT_CLIENT_KEY;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return req.headers.get('x-real-ip')?.trim() || DIRECT_CLIENT_KEY;
}

export const chatRateLimiter = new MemoryRateLimiter(DEFAULT_RATE_LIMIT);
export const terminalRateLimiter = new MemoryRateLimiter(TERMINAL_RATE_LIMIT);
