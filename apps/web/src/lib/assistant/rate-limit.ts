/**
 * Rate limit em memória por IP (janela deslizante). IPs ficam só em memória, nunca persistidos (LGPD).
 * Padrão: 20 requisições por 10 minutos.
 */

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = { max: 20, windowMs: 10 * 60 * 1000 };

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

/** IP do cliente: primeiro valor de x-forwarded-for, senão x-real-ip, senão 'unknown'. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export const chatRateLimiter = new MemoryRateLimiter(DEFAULT_RATE_LIMIT);
