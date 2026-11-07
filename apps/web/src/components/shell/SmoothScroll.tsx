'use client';
/**
 * Rolagem suave (Lenis) sincronizada com GSAP ScrollTrigger (docs/reformulacao-v4.md §7). Renderiza `null`;
 * colocado ANTES de `{children}` no layout.
 *
 * - Só instancia com `(prefers-reduced-motion: no-preference)` E `(hover: hover) and (pointer: fine)` E fora da
 *   "Versão simples"; escuta as duas media queries e o evento da versão simples e cria ou destrói na hora (não confia
 *   no `respectReducedMotion` do Lenis, que mantém o `preventDefault` da roda).
 * - `autoRaf: false` + `gsap.ticker` (sem `lenis/react`, cujo RAF brigaria com o ticker), `anchors: false`,
 *   `lenis.on('scroll', ScrollTrigger.update)`, `lagSmoothing(0)`; cleanup completo com `lagSmoothing(500, 33)`.
 * - `ScrollTrigger.refresh()` + `lenis.resize()` quando as fontes carregam e a cada troca de rota.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LENIS_OPTIONS, getLenis, setLenis } from '@/lib/motion/lenis';
import { FINE_POINTER_QUERY, NO_MOTION_PREFERENCE_QUERY, shouldSmoothScroll } from '@/lib/motion/prefs';
import { isSimpleMode, onSimpleMode } from '@/lib/motion/simple-mode';

gsap.registerPlugin(ScrollTrigger);

function refreshScroll(): void {
  getLenis()?.resize();
  ScrollTrigger.refresh();
}

export function SmoothScroll() {
  useEffect(() => {
    const noPref = window.matchMedia(NO_MOTION_PREFERENCE_QUERY);
    const fine = window.matchMedia(FINE_POINTER_QUERY);
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    const destroy = () => {
      if (!lenis) return;
      if (tick) gsap.ticker.remove(tick);
      tick = null;
      lenis.off('scroll', ScrollTrigger.update);
      lenis.destroy();
      lenis = null;
      setLenis(null);
      gsap.ticker.lagSmoothing(500, 33);
      ScrollTrigger.refresh();
    };

    const create = () => {
      if (lenis) return;
      const l = new Lenis({ ...LENIS_OPTIONS });
      l.on('scroll', ScrollTrigger.update);
      const t = (time: number) => l.raf(time * 1000);
      gsap.ticker.add(t);
      gsap.ticker.lagSmoothing(0);
      lenis = l;
      tick = t;
      setLenis(l);
      ScrollTrigger.refresh();
    };

    const sync = () => {
      if (shouldSmoothScroll({ noMotionPreference: noPref.matches, finePointer: fine.matches, simple: isSimpleMode() })) create();
      else destroy();
    };

    sync();
    noPref.addEventListener('change', sync);
    fine.addEventListener('change', sync);
    const offSimple = onSimpleMode(sync);

    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) refreshScroll();
    });

    return () => {
      alive = false;
      noPref.removeEventListener('change', sync);
      fine.removeEventListener('change', sync);
      offSimple();
      destroy();
    };
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    // Depois da pintura da nova rota: medidas novas para o Lenis e para os gatilhos.
    const id = window.requestAnimationFrame(refreshScroll);
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
