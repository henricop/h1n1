/**
 * Preferências de movimento (docs/reformulacao-v4.md §6 e §7). Funções puras + leitura segura no cliente.
 *
 * - `prefers-reduced-motion: reduce` OU "Versão simples" (`html[data-simple="1"]`) → nenhum movimento:
 *   sem Lenis, sem interpolação de tema, sem scrub, sem contagem.
 * - Rolagem suave (Lenis) só com `(prefers-reduced-motion: no-preference)` E `(hover: hover) and (pointer: fine)`:
 *   no toque, rolagem nativa.
 */
import { isSimpleMode } from './simple-mode';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const NO_MOTION_PREFERENCE_QUERY = '(prefers-reduced-motion: no-preference)';
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/** Decisão pura: instanciar o Lenis? (testável em node) */
export function shouldSmoothScroll(input: { noMotionPreference: boolean; finePointer: boolean; simple: boolean }): boolean {
  return input.noMotionPreference && input.finePointer && !input.simple;
}

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** `prefers-reduced-motion: reduce` no navegador (falso no servidor). */
export function prefersReducedMotion(): boolean {
  return matches(REDUCED_MOTION_QUERY);
}

/** Movimento desligado: reduced-motion do sistema OU "Versão simples". */
export function isMotionReduced(): boolean {
  return prefersReducedMotion() || isSimpleMode();
}
