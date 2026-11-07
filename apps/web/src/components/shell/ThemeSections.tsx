'use client';
/**
 * Tema por seção (docs/reformulacao-v4.md §6 e §7). Renderiza `null`.
 *
 * Observa todos os `[data-theme="paper | deep | warm"]` da página com `IntersectionObserver` e
 * `rootMargin: '-50% 0px -50% 0px'` (linha de referência = meio da janela). A seção que entrou por último e ainda
 * cruza a linha define o tema (`setTheme`, interpolado); sem nenhuma, volta a `paper`. Seções aninhadas funcionam
 * (a interna entra depois da externa). Re-observa quando o DOM muda (MutationObserver coalescido por quadro) e a
 * cada troca de rota; ao sair da página, volta a `paper` sem interpolar. Reduced-motion e "Versão simples":
 * a troca é instantânea (dentro de `setTheme`), e ligar a versão simples no meio de uma interpolação a encerra.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getTargetTheme, isThemeName, setTheme } from '@/lib/motion/theme';
import { REDUCED_MOTION_QUERY } from '@/lib/motion/prefs';
import { onSimpleMode } from '@/lib/motion/simple-mode';

const SELECTOR = '[data-theme]';
const ROOT_MARGIN = '-50% 0px -50% 0px';

export function ThemeSections() {
  const pathname = usePathname();

  useEffect(() => {
    // Entradas que cruzam a linha do meio, com a ordem em que entraram (a mais recente vence).
    const active = new Map<Element, number>();
    const observed = new Set<Element>();
    let seq = 0;
    let first = true;
    let frame = 0;

    const decide = () => {
      let best: Element | null = null;
      let bestSeq = -1;
      for (const [el, s] of active) {
        if (s > bestSeq) {
          best = el;
          bestSeq = s;
        }
      }
      const name = best?.getAttribute('data-theme');
      setTheme(isThemeName(name) ? name : 'paper');
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) active.set(e.target, ++seq);
          else active.delete(e.target);
        }
        decide();
      },
      { rootMargin: ROOT_MARGIN },
    );

    const scan = () => {
      frame = 0;
      const now = new Set(document.querySelectorAll(SELECTOR));
      for (const el of observed) {
        if (!now.has(el)) {
          io.unobserve(el);
          observed.delete(el);
          active.delete(el);
        }
      }
      for (const el of now) {
        if (!observed.has(el)) {
          io.observe(el);
          observed.add(el);
        }
      }
      // Na primeira varredura o retorno inicial do IO decide; sem seções, já volta a `paper`.
      if (!first || observed.size === 0) decide();
      first = false;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(scan);
    };

    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes' || r.addedNodes.length || r.removedNodes.length) {
          schedule();
          return;
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'] });
    scan();

    // Versão simples ligada (ou reduced-motion ativado) no meio de uma interpolação: encerra no destino.
    const settleNow = () => setTheme(getTargetTheme(), { immediate: true });
    const offSimple = onSimpleMode((on) => {
      if (on) settleNow();
    });
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    const onReduced = () => {
      if (reduced.matches) settleNow();
    };
    reduced.addEventListener('change', onReduced);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
      offSimple();
      reduced.removeEventListener('change', onReduced);
      // Saindo da página (troca de rota ou desmontagem): papel, sem interpolar sobre a página nova.
      setTheme('paper', { immediate: true });
    };
  }, [pathname]);

  return null;
}
