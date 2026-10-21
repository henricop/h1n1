/**
 * Acesso à instância única do Lenis (criada por components/shell/SmoothScroll.tsx, frente A) e rolagem até um
 * elemento com fallback nativo. Esqueleto compartilhado: a frente A implementa o provider; as demais frentes
 * só usam `scrollToEl`.
 */
import type Lenis from 'lenis';

let instance: Lenis | null = null;

export function getLenis(): Lenis | null {
  return instance;
}

export function setLenis(l: Lenis | null): void {
  instance = l;
}

/** Rola até `el`: Lenis (honra `scroll-margin-top`, `force: true` porque pode estar parado) ou `scrollIntoView`. */
export function scrollToEl(el: Element | null | undefined, opts: { reduced?: boolean; duration?: number } = {}): void {
  if (!el) return;
  const l = instance;
  if (l && !opts.reduced) {
    l.scrollTo(el as HTMLElement, { duration: opts.duration ?? 1.1, force: true });
    return;
  }
  el.scrollIntoView({ behavior: opts.reduced ? 'auto' : 'smooth', block: 'start' });
}
