/**
 * Capítulos (atos 1–5) da narrativa 3D. A coreografia (rolagem → estado da cena) vive em ./choreography.ts; o
 * estado em ./scenestate.ts. Este módulo mantém a lista de capítulos e reexporta a API usada pelos
 * componentes/testes.
 *
 * Contrato v4 (§6): kicker SEM número ("O que é"); o numeral do ato ("01") fica em `index` e é renderizado à
 * parte, `aria-hidden`, com nome acessível "Ato 1 de 7: O que é". Títulos exatamente como no contrato.
 */
import { clamp01 } from './geometry';
import { CHAPTER_COUNT, chapterFromProgress, sceneAt } from './choreography';

export { CHAPTER_COUNT, chapterFromProgress, sceneAt };
export { SCENE_KEYS, type SceneKey, type SceneState } from './scenestate';

export interface Chapter {
  /** id do capítulo (também usado no id da seção: `ato-${index}`) */
  id: string;
  /** numeral do ato na home, "01"…"05" */
  index: string;
  /** nome curto do ato, sem número ("O que é") */
  kicker: string;
  /** título do ato (Instrument Serif) */
  title: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'o-que-e', index: '01', kicker: 'O que é', title: 'Um vírus da gripe, de perto.' },
  { id: 'por-dentro', index: '02', kicker: 'Por dentro', title: 'Peça por peça.' },
  { id: 'como-entra', index: '03', kicker: 'Como entra', title: 'Uma chave, uma fechadura.' },
  { id: 'como-se-espalha', index: '04', kicker: 'Como se espalha', title: 'De uma pessoa para outra.' },
  { id: 'vacina', index: '05', kicker: 'A vacina', title: 'Anticorpos prontos antes do encontro.' },
];

/** Total de atos da home (5 do filme + "No Brasil" + "Continue daqui"). */
export const HOME_ACT_COUNT = 7;

/** Nome acessível do kicker de um ato: "Ato 3 de 7: Como entra". */
export function actAccessibleName(index: string, kicker: string): string {
  return `Ato ${Number(index)} de ${HOME_ACT_COUNT}: ${kicker}`;
}

/** @deprecated use sceneAt(index + local) */
export function sceneState(index: number, local: number) {
  return sceneAt(Math.max(0, Math.min(CHAPTER_COUNT - 1, index)) + clamp01(local));
}

/** @deprecated use sceneAt */
export const sceneStateFromProgress = sceneAt;

/**
 * Progresso contínuo a partir da posição dos capítulos (um bloco por capítulo). Mantido para compatibilidade;
 * o explainer usa progressFromSteps (choreography.ts).
 */
export function progressFromLayout(refY: number, tops: readonly number[], heights: readonly number[]): number {
  const n = tops.length;
  if (n === 0) return 0;
  if (refY < tops[0]!) return 0;
  for (let i = 0; i < n; i++) {
    const top = tops[i]!;
    const h = Math.max(1, heights[i] ?? 1);
    const next = i + 1 < n ? tops[i + 1]! : top + h;
    if (refY < next) return i + clamp01((refY - top) / (next - top));
  }
  return n - 1e-6;
}
