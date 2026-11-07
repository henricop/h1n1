/**
 * Acesso à instância única do Lenis (criada por components/shell/SmoothScroll.tsx) e rolagem até um elemento com
 * fallback nativo. As demais frentes só usam `scrollToEl` / `getLenis`.
 *
 * O Lenis rola a JANELA nativa (`window.scrollTo` por quadro): `window.scrollY`, `useScroll` do motion e
 * `progressFromSteps` continuam válidos. Ele só existe com `(prefers-reduced-motion: no-preference)`,
 * `(hover: hover) and (pointer: fine)` e fora da "Versão simples".
 */
import type Lenis from 'lenis';
import { isMotionReduced } from './prefs';

let instance: Lenis | null = null;

export function getLenis(): Lenis | null {
  return instance;
}

export function setLenis(l: Lenis | null): void {
  instance = l;
}

/** Parâmetros do Lenis (contrato §6: `lerp` ≤ 0,1; sem âncoras automáticas; RAF pelo ticker do GSAP). */
export const LENIS_OPTIONS = { autoRaf: false, anchors: false, lerp: 0.1, smoothWheel: true, stopInertiaOnNavigate: true } as const;

/**
 * Rola até `el`: Lenis (honra `scroll-margin-top`; `force: true` porque pode estar parado) ou `scrollIntoView`.
 * `reduced` padrão: reduced-motion do sistema ou "Versão simples" (rolagem instantânea).
 */
export function scrollToEl(el: Element | null | undefined, opts: { reduced?: boolean; duration?: number } = {}): void {
  if (!el) return;
  const reduced = opts.reduced ?? isMotionReduced();
  const l = instance;
  if (l && !reduced) {
    l.scrollTo(el as HTMLElement, { duration: opts.duration ?? 1.1, force: true });
    return;
  }
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

/** Recalcula as medidas do Lenis (fontes carregadas, troca de rota, mudança de altura do documento). */
export function resizeLenis(): void {
  instance?.resize();
}
