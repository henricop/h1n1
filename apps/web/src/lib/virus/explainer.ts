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

/**
 * Cor de fundo opaca inicial do canvas (= token papel `#f4f1ea`). Em v4 o fundo real é a cor VIVA do tema
 * (`getLiveTheme()`), mutada por quadro em `scene.background`; esta constante só vale sem o shell de temas.
 */
export const CANVAS_BACKGROUND = '#f4f1ea';

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

/** Teto de DPR por qualidade (DESIGN.md: DPR ≤ 1,5; perfil 'low' ≤ 1,25). */
export const MAX_DPR: Readonly<Record<Quality, number>> = { high: 1.5, low: 1.25 };

/**
 * DPR do palco: o do aparelho limitado a [1, MAX_DPR[quality]] e multiplicado pelo fator de desempenho do r3f
 * (`performance.current`, que cai durante a rolagem). Diferente do `<AdaptiveDpr>` do drei, segue a qualidade
 * ATUAL (o drei volta ao DPR da criação do canvas, mesmo depois de a qualidade cair para 'low').
 */
export function stageDpr(devicePixelRatio: number, quality: Quality, performanceCurrent = 1): number {
  const device = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const perf = Number.isFinite(performanceCurrent) ? Math.min(1, Math.max(0.1, performanceCurrent)) : 1;
  return Math.min(MAX_DPR[quality], Math.max(1, device)) * perf;
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

/**
 * Região (frações 0–1 da largura/altura do canvas) onde os cartões de rótulo podem ficar, informada pelo
 * explainer: no desktop, a faixa livre à direita do texto; no celular, o palco inteiro.
 */
export interface LabelRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LabelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Limites do CENTRO do cartão (px): retângulo útil do palco (margens `pad`) intersectado com a `region`
 * (se houver), encolhido de meio cartão. Região inválida/vazia cai no palco inteiro; região menor que um
 * cartão colapsa no centro dela (nunca inverte os limites).
 */
export function labelBounds(width: number, height: number, region?: LabelRegion | null, card: { w: number; h: number } = LABEL_CARD, pad: { top: number; bottom: number; side: number } = LABEL_PAD): LabelBounds {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  let left = pad.side;
  let right = w - pad.side;
  let top = pad.top;
  let bottom = h - pad.bottom;
  if (region) {
    const f = (v: number, d: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
    const rl = f(region.left, 0);
    const rr = f(region.right, 1);
    const rt = f(region.top, 0);
    const rb = f(region.bottom, 1);
    if (rr > rl && rb > rt) {
      left = Math.max(left, rl * w);
      right = Math.min(right, rr * w);
      top = Math.max(top, rt * h);
      bottom = Math.min(bottom, rb * h);
    }
  }
  const fit = (lo: number, hi: number, size: number): [number, number] => {
    const a = lo + size / 2;
    const b = hi - size / 2;
    if (b >= a) return [a, b];
    // não cabe: centro da faixa (ou a borda mínima, se a faixa for degenerada)
    const c = hi > lo ? (lo + hi) / 2 : Math.max(size / 2, lo);
    return [c, c];
  };
  const [minX, maxX] = fit(left, right, card.w);
  const [minY, maxY] = fit(top, bottom, card.h);
  return { minX, maxX, minY, maxY };
}

/** Centro do cartão limitado ao retângulo útil do palco (e à `region` livre de texto, se informada). */
export function clampToStage(x: number, y: number, width: number, height: number, card: { w: number; h: number } = LABEL_CARD, pad: { top: number; bottom: number; side: number } = LABEL_PAD, region?: LabelRegion | null): Vec3 {
  const { minX, maxX, minY, maxY } = labelBounds(width, height, region, card, pad);
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
 * Afasta cartões que ficaram sobrepostos (depois do limite ao palco/região): varre em ordem e empurra o cartão
 * seguinte para baixo (ou para cima, se não couber) até deixar de cobrir os anteriores. Muta `pts`.
 */
export function spreadLabels(pts: Array<{ x: number; y: number }>, width: number, height: number, card: { w: number; h: number } = LABEL_CARD, pad: { top: number; bottom: number; side: number } = LABEL_PAD, gap = 6, region?: LabelRegion | null): void {
  const { minX, maxX, minY, maxY } = labelBounds(width, height, region, card, pad);
  const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < card.w + gap && Math.abs(a.y - b.y) < card.h + gap;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    for (let pass = 0; pass < 6; pass++) {
      const q = pts.slice(0, i).find((o) => overlaps(p, o));
      if (!q) break;
      // tenta, nesta ordem: abaixo, acima, à direita, à esquerda do cartão já colocado
      const cands = [
        { x: p.x, y: q.y + card.h + gap },
        { x: p.x, y: q.y - card.h - gap },
        { x: q.x + card.w + gap, y: p.y },
        { x: q.x - card.w - gap, y: p.y },
      ].filter((c) => c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY);
      const free = cands.find((c) => !pts.slice(0, i).some((o) => overlaps(c, o)));
      const pick = free ?? cands[0];
      if (!pick) break;
      p.x = pick.x;
      p.y = pick.y;
    }
  }
}

/** Palco pequeno (celular): só o rótulo da peça em foco, para não cobrir o vírion. */
export function compactStage(width: number, height: number): boolean {
  return width < 560 || height < 460;
}

/** Deslocamento do enquadramento: fração da viewport; +x = conteúdo à direita, +y = conteúdo para cima. */
export interface ViewShift {
  x: number;
  y: number;
}

/** Limite de segurança do deslocamento (fração da viewport) em cada eixo. */
export const VIEW_SHIFT_MAX = 0.45;

/**
 * Argumentos de `camera.setViewOffset(w, h, x, y, w, h)` (px) para um `viewShift`: a janela da câmera anda no
 * sentido oposto ao conteúdo (x = round(−shift.x·w), y = round(shift.y·h)). `null` = sem deslocamento
 * (`clearViewOffset`). Tolera NaN/∞ e satura em ±VIEW_SHIFT_MAX.
 */
export function viewOffsetFor(shift: Readonly<ViewShift> | null | undefined, width: number, height: number): { x: number; y: number } | null {
  if (!shift || !(width > 0) || !(height > 0)) return null;
  const c = (v: number) => (Number.isFinite(v) ? Math.min(VIEW_SHIFT_MAX, Math.max(-VIEW_SHIFT_MAX, v)) : 0);
  const x = Math.round(-c(shift.x) * width);
  const y = Math.round(c(shift.y) * height);
  if (x === 0 && y === 0) return null;
  // -0 → 0 (evita "−0px" e comparações estranhas)
  return { x: x + 0, y: y + 0 };
}

/**
 * Elementos do DOM sobre o palco que "engolem" o ponteiro: com `eventSource` no contêiner do filme, o r3f
 * recebe também os eventos de botões, links e painéis por cima do canvas. Nesses alvos a cena não faz hover,
 * clique nem `onPointerMissed`. Painéis comuns podem optar por fora com `data-canvas-ignore`.
 */
export const DOM_CONTROL_SELECTOR = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="dialog"], [data-canvas-ignore]';

/** O alvo real do evento é um controle do DOM (ou está dentro de um)? Puro: aceita qualquer objeto com `closest`. */
export function isDomControl(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { closest?: (sel: string) => unknown; tagName?: unknown };
  // o próprio <canvas> (ou o wrapper do r3f) nunca é controle
  if (typeof el.tagName === 'string' && el.tagName.toUpperCase() === 'CANVAS') return false;
  if (typeof el.closest !== 'function') return false;
  try {
    return el.closest(DOM_CONTROL_SELECTOR) != null;
  } catch {
    return false;
  }
}
