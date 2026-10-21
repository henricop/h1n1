/**
 * Capítulos da narrativa 3D. A coreografia (rolagem → estado da cena) vive em ./choreography.ts; o estado em
 * ./scenestate.ts. Este módulo mantém a lista de capítulos e reexporta a API usada pelos componentes/testes.
 */
import { clamp01 } from './geometry';
import { CHAPTER_COUNT, chapterFromProgress, sceneAt } from './choreography';

export { CHAPTER_COUNT, chapterFromProgress, sceneAt };
export { SCENE_KEYS, type SceneKey, type SceneState } from './scenestate';

export interface Chapter {
  /** id do elemento <li> (âncora) */
  id: string;
  kicker: string;
  title: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'o-que-e', kicker: 'Capítulo 1', title: 'O que é o H1N1?' },
  { id: 'por-dentro', kicker: 'Capítulo 2', title: 'Por dentro' },
  { id: 'como-entra', kicker: 'Capítulo 3', title: 'Como ele entra' },
  { id: 'como-se-espalha', kicker: 'Capítulo 4', title: 'Como se espalha' },
  { id: 'vacina', kicker: 'Capítulo 5', title: 'Como a vacina ajuda' },
];

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
