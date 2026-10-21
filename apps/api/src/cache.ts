/**
 * Cache LRU em memória para respostas prontas das rotas de visualização (globo e mapa do Brasil).
 *
 * A chave inclui a snapshot da publicação vigente do indicador: quando a publicação muda, a chave muda e a
 * entrada antiga deixa de ser lida (e é expulsa por LRU/TTL). Entradas expiram após `ttlMs` (default 10 min)
 * e o cache guarda no máximo `max` entradas (default 50), descartando a menos recentemente usada.
 */
export const VIZ_CACHE_TTL_MS = 10 * 60 * 1000;
export const VIZ_CACHE_MAX = 50;

export interface LruCacheOptions {
  ttlMs?: number;
  max?: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruCache<V> {
  readonly ttlMs: number;
  readonly max: number;
  private readonly now: () => number;
  private readonly map = new Map<string, Entry<V>>();
  hits = 0;
  misses = 0;

  constructor(opts: LruCacheOptions = {}) {
    this.ttlMs = Math.max(0, opts.ttlMs ?? VIZ_CACHE_TTL_MS);
    this.max = Math.max(1, Math.floor(opts.max ?? VIZ_CACHE_MAX));
    this.now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.map.size;
  }

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) {
      this.misses++;
      return undefined;
    }
    if (e.expiresAt <= this.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // LRU: reinsere para marcar como mais recente
    this.map.delete(key);
    this.map.set(key, e);
    this.hits++;
    return e.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    const e = this.map.get(key);
    return !!e && e.expiresAt > this.now();
  }

  /** Remove as entradas cuja chave começa com `prefix` (ex.: `globe|<indicador>|`). */
  invalidatePrefix(prefix: string): number {
    let n = 0;
    for (const k of [...this.map.keys()]) {
      if (k.startsWith(prefix)) {
        this.map.delete(k);
        n++;
      }
    }
    return n;
  }

  clear(): void {
    this.map.clear();
  }
}

/** Chave canônica: partes vazias/indefinidas viram '' para que `from` ausente e `from=''` colidam. */
export function cacheKey(parts: ReadonlyArray<string | null | undefined>): string {
  return parts.map((p) => p ?? '').join('|');
}
