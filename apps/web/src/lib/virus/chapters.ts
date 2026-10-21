/**
 * Capítulos da narrativa 3D e mapeamento rolagem → estado da cena (função pura, testável).
 *
 * `progress` é contínuo em [0, N): parte inteira = capítulo; parte fracionária = posição da linha de
 * referência (meio da tela) dentro do capítulo. Quando um capítulo "encaixa" no topo da janela, a linha
 * de referência está em local ≈ 0,5; por isso toda transição acontece em local ∈ [0, 0,5] e o estado
 * "assentado" vale de 0,5 em diante.
 */
import { clamp01, lerp, smoothstep } from './geometry';

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

export const CHAPTER_COUNT = CHAPTERS.length;

export function chapterFromProgress(progress: number, count: number = CHAPTER_COUNT): { index: number; local: number } {
  if (!Number.isFinite(progress) || progress <= 0) return { index: 0, local: 0 };
  if (progress >= count) return { index: count - 1, local: 1 };
  const index = Math.floor(progress);
  return { index, local: progress - index };
}

/** Estado-alvo da cena (todos os campos numéricos em unidades de cena ou em [0, 1]). */
export interface SceneState {
  /** 0 = vírus inteiro; 1 = peças afastadas */
  explode: number;
  /** fator de rotação automática (0 = parado) */
  spin: number;
  /** rótulos das peças visíveis */
  labels: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  virusX: number;
  virusY: number;
  virusScale: number;
  /** célula-alvo (capítulo 3) */
  cell: number;
  /** aproximação do vírus à célula (capítulo 3) */
  approach: number;
  /** silhuetas (capítulo 4) */
  people: number;
  /** gotículas percorrendo o trajeto (capítulo 4) */
  droplets: number;
  /** anticorpos aproximando-se e grudando (capítulo 5) */
  antibodies: number;
}

export const SCENE_KEYS = [
  'explode',
  'spin',
  'labels',
  'cameraX',
  'cameraY',
  'cameraZ',
  'virusX',
  'virusY',
  'virusScale',
  'cell',
  'approach',
  'people',
  'droplets',
  'antibodies',
] as const satisfies ReadonlyArray<keyof SceneState>;

const BASE: SceneState = {
  explode: 0,
  spin: 1,
  labels: 0,
  cameraX: 0,
  cameraY: 0.15,
  cameraZ: 5.4,
  virusX: 0,
  virusY: 0,
  virusScale: 1,
  cell: 0,
  approach: 0,
  people: 0,
  droplets: 0,
  antibodies: 0,
};

/** Estado-alvo para um capítulo e posição local (0..1) dentro dele. */
export function sceneState(index: number, local: number): SceneState {
  const l = clamp01(local);
  const s: SceneState = { ...BASE };
  switch (index) {
    case 0: {
      s.explode = 0;
      s.spin = 1;
      s.cameraZ = 5.4;
      break;
    }
    case 1: {
      const e = smoothstep(0, 0.45, l);
      s.explode = e;
      s.spin = lerp(1, 0.25, smoothstep(0, 0.2, l));
      s.labels = smoothstep(0.6, 0.85, e);
      s.cameraZ = lerp(5.4, 7.6, e);
      break;
    }
    case 2: {
      s.explode = 1 - smoothstep(0, 0.2, l);
      s.labels = 1 - smoothstep(0, 0.1, l);
      s.spin = lerp(0.25, 0.35, smoothstep(0, 0.2, l));
      s.cell = smoothstep(0.05, 0.3, l);
      s.approach = smoothstep(0.25, 0.75, l);
      s.virusX = lerp(lerp(0, -1, smoothstep(0, 0.25, l)), -0.27, s.approach);
      s.cameraX = lerp(0, 0.7, s.cell);
      s.cameraZ = lerp(7.6, 7, smoothstep(0, 0.3, l));
      break;
    }
    case 3: {
      const t = smoothstep(0, 0.3, l);
      s.spin = lerp(0.35, 0.6, t);
      s.cell = 1 - smoothstep(0, 0.18, l);
      s.approach = 1 - t;
      s.people = smoothstep(0.05, 0.3, l);
      s.virusScale = lerp(1, 0.32, t);
      s.virusX = lerp(-0.27, -2.35, t);
      s.virusY = lerp(0, 0.95, t);
      s.cameraX = lerp(0.7, 0, t);
      s.cameraZ = lerp(7, 12.5, t);
      s.cameraY = lerp(0.15, 0.3, t);
      s.droplets = smoothstep(0.3, 0.85, l);
      break;
    }
    default: {
      const t = smoothstep(0, 0.3, l);
      s.spin = lerp(0.6, 0.4, t);
      s.people = 1 - smoothstep(0, 0.15, l);
      s.droplets = 1 - smoothstep(0, 0.15, l);
      s.virusScale = lerp(0.32, 1, t);
      s.virusX = lerp(-2.35, 0, t);
      s.virusY = lerp(0.95, 0, t);
      s.cameraZ = lerp(12.5, 5.6, t);
      s.cameraY = lerp(0.3, 0.15, t);
      s.antibodies = smoothstep(0.3, 0.8, l);
      break;
    }
  }
  return s;
}

export function sceneStateFromProgress(progress: number): SceneState {
  const { index, local } = chapterFromProgress(progress);
  return sceneState(index, local);
}

/**
 * Progresso contínuo a partir da posição dos capítulos no documento.
 * `tops` e `heights` em px (offset dos <li> em relação ao início do documento); `refY` = linha de
 * referência (scrollY + metade da janela).
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
