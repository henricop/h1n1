/**
 * Funções puras do explainer e do driver 3D (sem React, sem WebGL): política de frameloop, linha de referência
 * da rolagem por breakpoint, capítulo com histerese, trilho de progresso e alvos de opacidade dos rótulos.
 * Testadas em test/virus-explainer.test.ts.
 */
import { CHAPTER_COUNT } from './choreography';
import { clamp01, type Vec3 } from './geometry';
import type { PartId } from './parts';
import type { Quality } from './pose';

/** Modo do laço de quadros: `manual` = `frameloop: never` + rAF próprio limitado a LOW_FPS. */
export type FrameloopMode = 'always' | 'demand' | 'never' | 'manual';

/** Teto de quadros por segundo em `quality: 'low'`. */
export const LOW_FPS = 30;

/** Cor de fundo opaca do canvas (= token bg-soft). */
export const CANVAS_BACKGROUND = '#f5f7fb';

/**
 * Política (decisão 4 do contrato): `never` fora da tela ou com a aba oculta; `demand` com reduced-motion;
 * `manual` (~30 fps) em qualidade baixa; `always` no resto.
 */
export function frameloopPolicy({ active, reducedMotion, quality }: { active: boolean; reducedMotion: boolean; quality: Quality }): FrameloopMode {
  if (!active) return 'never';
  if (reducedMotion) return 'demand';
  return quality === 'low' ? 'manual' : 'always';
}

/** Decide se o laço manual deve renderizar este quadro (tolerância de 1,5 ms para o jitter do rAF). */
export function shouldRenderFrame(now: number, last: number, fps: number = LOW_FPS): boolean {
  if (!Number.isFinite(last)) return true;
  return now - last >= 1000 / Math.max(1, fps) - 1.5;
}

/** Escala do render target de transmissão (meshPhysicalMaterial) por qualidade. */
export function transmissionScale(quality: Quality): number {
  return quality === 'low' ? 0.35 : 0.5;
}

export interface ReferenceInput {
  scrollY: number;
  innerHeight: number;
  /** layout empilhado (palco sticky acima dos capítulos; < lg) */
  stacked: boolean;
  /** base do palco em coordenadas da janela (px); só usado quando `stacked` */
  stageBottom?: number;
}

/**
 * Linha de referência (em coordenadas do documento) que define o progresso: desktop = meio da janela; mobile =
 * meio da faixa visível abaixo do palco. Se o palco cobrir a janela inteira, usa a base da janela.
 */
export function referenceLine({ scrollY, innerHeight, stacked, stageBottom }: ReferenceInput): number {
  const h = Math.max(0, innerHeight);
  if (!stacked || stageBottom === undefined || !Number.isFinite(stageBottom)) return scrollY + h * 0.5;
  const bottom = Math.max(0, Math.min(h, stageBottom));
  return scrollY + bottom + (h - bottom) / 2;
}

/**
 * Capítulo atual a partir do progresso, com histerese pequena nas bordas para não oscilar entre dois capítulos
 * quando a linha de referência fica parada sobre a fronteira. Saltos de 2+ capítulos são imediatos.
 */
export function chapterWithHysteresis(progress: number, current: number, margin = 0.04, count: number = CHAPTER_COUNT): number {
  const p = Number.isFinite(progress) ? progress : 0;
  const idx = Math.max(0, Math.min(count - 1, Math.floor(p)));
  const cur = Math.max(0, Math.min(count - 1, Math.floor(current)));
  if (idx === cur) return cur;
  if (Math.abs(idx - cur) >= 2) return idx;
  if (idx > cur) return p >= idx + margin ? idx : cur;
  return p < cur - margin ? idx : cur;
}

/** Índice global do primeiro passo de cada capítulo (acumulado de `stepsPerChapter`). */
export function firstStepIndices(stepsPerChapter: readonly number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const n of stepsPerChapter) {
    out.push(acc);
    acc += n;
  }
  return out;
}

/** Preenchimento (0..1) de cada ponto do trilho de progresso: passados = 1, atual = fração, futuros = 0. */
export function dotFills(progress: number, count: number = CHAPTER_COUNT): number[] {
  const p = Number.isFinite(progress) ? progress : 0;
  return Array.from({ length: count }, (_, i) => clamp01(p - i));
}

/** Peças cujo rótulo acende sozinho com o canal `labels` (as demais só em hover/seleção). */
export const AUTO_LABELS: ReadonlySet<PartId> = new Set<PartId>(['ha', 'na', 'rna', 'envelope']);

/** Alvo de opacidade de um rótulo: 1 se em hover/seleção; senão o canal `labels` para as 4 principais. */
export function labelTarget(id: PartId, labels: number, hovered: PartId | null, selected: PartId | null): number {
  if (hovered === id || selected === id) return 1;
  return AUTO_LABELS.has(id) ? clamp01(labels) : 0;
}

/** Deslocamento radial do cartão em relação ao ponto da peça (unidades de cena, quadro do vírion). */
export const LABEL_OFFSET: Readonly<Record<PartId, number>> = {
  ha: 0.5,
  na: 0.5,
  m2: 0.42,
  envelope: 0.4,
  m1: 0.55,
  rna: 0.6,
};

/** Posição do cartão: ponto da peça empurrado para fora ao longo do raio (ou para cima, se estiver no centro). */
export function labelPosition(id: PartId, anchor: Vec3): Vec3 {
  const len = Math.hypot(anchor.x, anchor.y, anchor.z);
  const k = LABEL_OFFSET[id];
  if (len < 1e-6) return { x: anchor.x, y: anchor.y + k, z: anchor.z };
  return { x: anchor.x + (anchor.x / len) * k, y: anchor.y + (anchor.y / len) * k, z: anchor.z + (anchor.z / len) * k };
}

/** Limiar de opacidade a partir do qual o rótulo recebe eventos de ponteiro. */
export const LABEL_POINTER_THRESHOLD = 0.6;

/** Ordem dos rótulos (cartões DOM do palco). */
export const LABEL_IDS: readonly PartId[] = ['ha', 'na', 'rna', 'envelope', 'm1', 'm2'];
/** Tamanho estimado do cartão (px) para manter o rótulo inteiro dentro do palco. */
export const LABEL_CARD = { w: 184, h: 96 } as const;
/** Margens do palco reservadas para controles (pill/botões em cima, chips embaixo). */
export const LABEL_PAD = { top: 64, bottom: 76, side: 10 } as const;

/** Centro do cartão limitado ao retângulo útil do palco. */
export function clampToStage(x: number, y: number, width: number, height: number, card: { w: number; h: number } = LABEL_CARD, pad: { top: number; bottom: number; side: number } = LABEL_PAD): Vec3 {
  const minX = pad.side + card.w / 2;
  const maxX = Math.max(minX, width - pad.side - card.w / 2);
  const minY = pad.top + card.h / 2;
  const maxY = Math.max(minY, height - pad.bottom - card.h / 2);
  const cx = Number.isFinite(x) ? Math.min(maxX, Math.max(minX, x)) : minX;
  const cy = Number.isFinite(y) ? Math.min(maxY, Math.max(minY, y)) : minY;
  return { x: cx, y: cy, z: 0 };
}

/** Classe do ponto colorido de cada rótulo (tokens do tema). */
export function labelDotClass(id: PartId): string {
  switch (id) {
    case 'ha':
      return 'bg-primary-600';
    case 'na':
      return 'bg-h1n1';
    case 'rna':
      return 'bg-infb';
    default:
      return 'bg-line-strong';
  }
}

/**
 * Afasta cartões que ficaram sobrepostos (depois do limite ao palco): varre em ordem e empurra o cartão
 * seguinte para baixo (ou para cima, se não couber) até deixar de cobrir os anteriores. Muta `pts`.
 */
export function spreadLabels(pts: Array<{ x: number; y: number }>, width: number, height: number, card: { w: number; h: number } = LABEL_CARD, pad: { top: number; bottom: number; side: number } = LABEL_PAD, gap = 6): void {
  const minY = pad.top + card.h / 2;
  const maxY = Math.max(minY, height - pad.bottom - card.h / 2);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (let j = 0; j < i; j++) {
        const q = pts[j]!;
        const dx = Math.abs(p.x - q.x);
        const dy = Math.abs(p.y - q.y);
        if (dx < card.w + gap && dy < card.h + gap) {
          const down = q.y + card.h + gap;
          const up = q.y - card.h - gap;
          p.y = down <= maxY ? down : Math.max(minY, up);
          moved = true;
        }
      }
      if (!moved) break;
    }
    p.x = Math.min(Math.max(p.x, pad.side + card.w / 2), Math.max(pad.side + card.w / 2, width - pad.side - card.w / 2));
  }
}
