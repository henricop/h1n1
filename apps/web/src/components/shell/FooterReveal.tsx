'use client';
/**
 * Guarda do rodapé revelado (docs/reformulacao-v4.md §6 e §7). O rodapé só fica `sticky` por baixo do conteúdo
 * (`data-reveal="on"`) quando TUDO vale: janela fora de `(max-width: 767px), (max-height: 640px)`, sem
 * reduced-motion, fora da "Versão simples" e rodapé com menos de 70 % da altura da janela. Senão (e sem JS),
 * fluxo normal. Publica a altura em `--footer-height` no `<html>`. Renderiza `null`.
 */
import { useEffect } from 'react';
import { REDUCED_MOTION_QUERY } from '@/lib/motion/prefs';
import { isSimpleMode, onSimpleMode } from '@/lib/motion/simple-mode';

/** Fração máxima da altura da janela para o rodapé ficar revelado. */
export const FOOTER_REVEAL_MAX = 0.7;
/** Onde o rodapé volta ao fluxo normal (igual ao contrato §7). */
export const FOOTER_STATIC_QUERY = '(max-width: 767px), (max-height: 640px)';

/** Decisão pura (testável em node). */
export function footerRevealOn(input: { footerHeight: number; viewportHeight: number; staticMedia: boolean; reducedMotion: boolean; simple: boolean }): boolean {
  return !input.staticMedia && !input.reducedMotion && !input.simple && input.footerHeight > 0 && input.footerHeight < input.viewportHeight * FOOTER_REVEAL_MAX;
}

export function FooterReveal({ targetId }: { targetId: string }) {
  useEffect(() => {
    const footer = document.getElementById(targetId);
    if (!footer) return;
    const html = document.documentElement;
    const staticMq = window.matchMedia(FOOTER_STATIC_QUERY);
    const reducedMq = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => {
      const h = footer.offsetHeight;
      html.style.setProperty('--footer-height', `${h}px`);
      const on = footerRevealOn({ footerHeight: h, viewportHeight: window.innerHeight, staticMedia: staticMq.matches, reducedMotion: reducedMq.matches, simple: isSimpleMode() });
      footer.dataset.reveal = on ? 'on' : 'off';
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(footer);
    window.addEventListener('resize', update);
    staticMq.addEventListener('change', update);
    reducedMq.addEventListener('change', update);
    const offSimple = onSimpleMode(update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      staticMq.removeEventListener('change', update);
      reducedMq.removeEventListener('change', update);
      offSimple();
      html.style.removeProperty('--footer-height');
    };
  }, [targetId]);
  return null;
}
