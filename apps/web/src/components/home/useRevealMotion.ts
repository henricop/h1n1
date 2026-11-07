'use client';
/**
 * Movimento DOM do filme (contrato v4 §7, SplitText): títulos de ato revelados por linhas (`[data-reveal-title]`,
 * classe `.reveal-line`, `autoSplit` com `onSplit` devolvendo a animação) e fade/translate curto (≤ 600 ms) dos
 * blocos de passo ao entrar (`[data-reveal-block]`). Tudo dentro de `gsap.context` e revertido no cleanup
 * (cobre o StrictMode). Só roda com `enabled` (fora de `prefers-reduced-motion` e da "Versão simples");
 * o texto fica sempre no HTML do servidor.
 */
import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

export function useRevealMotion(root: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const el = root.current;
    if (!el) return undefined;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    const ctx = gsap.context(() => {
      el.querySelectorAll<HTMLElement>('[data-reveal-title]').forEach((h) => {
        SplitText.create(h, {
          type: 'lines',
          linesClass: 'reveal-line',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              opacity: 0,
              duration: 0.6,
              stagger: 0.07,
              ease: 'power3.out',
              scrollTrigger: { trigger: h, start: 'top 88%', once: true },
            }),
        });
      });
      el.querySelectorAll<HTMLElement>('[data-reveal-block]').forEach((b) => {
        gsap.from(b, { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 92%', once: true } });
      });
    }, el);
    const refresh = () => ScrollTrigger.refresh();
    if (typeof document !== 'undefined' && 'fonts' in document) document.fonts.ready.then(refresh, () => undefined);
    return () => ctx.revert();
  }, [root, enabled]);
}
