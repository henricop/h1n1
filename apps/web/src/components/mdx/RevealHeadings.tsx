'use client';

import { useEffect } from 'react';
import { isMotionReduced } from '@/lib/motion/prefs';
import { onSimpleMode } from '@/lib/motion/simple-mode';

/**
 * Revelação discreta dos títulos de seção (`h2`) por linhas, quando entram na tela (docs/reformulacao-v4.md §7).
 *  - Só títulos ABAIXO da dobra: nada acima da dobra e nada que o leitor já esteja vendo (o H1 usa keyframes CSS).
 *  - SplitText dentro de `gsap.context` (`ctx.revert()` no cleanup, cobre o StrictMode) com `autoSplit` e a animação
 *    RETORNADA por `onSplit`, para re-dividir ao carregar as fontes e ao mudar a largura.
 *  - O texto continua no HTML do servidor; nada acontece com `prefers-reduced-motion` nem em "Versão simples"
 *    (desligar a versão simples com a página aberta não reativa; ligar reverte na hora). Na impressão, as linhas voltam ao lugar.
 */
export function RevealHeadings({ selector = '.prose h2' }: { selector?: string }) {
  useEffect(() => {
    if (isMotionReduced()) return;
    let cancelled = false;
    let revert: (() => void) | null = null;

    (async () => {
      const [{ gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText')]);
      if (cancelled || isMotionReduced()) return;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      const ctx = gsap.context(() => {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          if (el.getBoundingClientRect().top < window.innerHeight) return; // já visível: não anima
          SplitText.create(el, {
            type: 'lines',
            mask: 'lines',
            linesClass: 'reveal-line',
            autoSplit: true,
            onSplit(self) {
              return gsap.from(self.lines, {
                yPercent: 110,
                duration: 0.8,
                ease: 'power3.out',
                stagger: 0.08,
                scrollTrigger: { trigger: el, start: 'top 88%', once: true },
              });
            },
          });
        });
      });
      revert = () => ctx.revert();
    })();

    const offSimple = onSimpleMode((on) => {
      if (on) revert?.();
    });
    return () => {
      cancelled = true;
      offSimple();
      revert?.();
    };
  }, [selector]);

  return null;
}
