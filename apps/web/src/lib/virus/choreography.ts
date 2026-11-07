/**
 * Coreografia do explicador 3D: poses assentadas por capítulo + batidas por chave (janelas ou keyframes em
 * progresso local). `sceneAt(p)` é pura e contínua por construção: o fim do capítulo i é a pose POSES[i], que
 * é também o início do capítulo i+1. Testada em test/virus.test.ts sem WebGL.
 *
 * Progresso `p` ∈ [0, N): parte inteira = capítulo; fração = posição dentro do capítulo, uniforme por PASSO de
 * texto (`progressFromSteps`): p = i + (k + frac) / STEPS_PER_CHAPTER[i].
 */
import { clamp01, smoothstep } from './geometry';
import { REST, SCENE_KEYS, type SceneKey, type SceneState } from './scenestate';

export const CHAPTER_COUNT = 5;

/** Passos de texto por capítulo (copy.ts deve ter exatamente estas contagens). */
export const STEPS_PER_CHAPTER: readonly number[] = [3, 5, 5, 4, 5];

/** Distância (em x, no grupo micro) do centro do vírion até a superfície da membrana no encaixe. */
export const CONTACT_X = 1.34;
/** Folga inicial entre vírion e membrana, fechada por `dock`. */
export const DOCK_GAP = 0.6;
/** Boca das silhuetas (capítulos 4 e 5), em unidades de cena. */
export const MOUTH_LEFT = { x: -2.35, y: 0.95 } as const;
export const MOUTH_RIGHT = { x: 2.35, y: 0.95 } as const;
/** Onde o vírion "estaciona" diante de cada boca (afastado do rosto para não se sobrepor à cabeça). */
export const CARRY_LEFT = { x: MOUTH_LEFT.x + 0.45, y: MOUTH_LEFT.y } as const;
export const CARRY_RIGHT = { x: MOUTH_RIGHT.x - 0.45, y: MOUTH_RIGHT.y } as const;
/** Escala do grupo micro quando visto "de longe" (capítulo 4). */
export const FAR_SCALE = 0.32;

/**
 * Curvas de uma batida (todas valem 0 em 0 e 1 em 1, então a continuidade `sceneAt(i + 1) === POSES[i]` não
 * depende da curva): `smooth` = smoothstep (C1); `smoother` = smootherstep de Perlin (C2: aceleração nula nas
 * pontas, para aberturas e encaixes "orgânicos", sem tranco); `linear` só onde outra peça precisa acompanhar
 * exatamente o mesmo ritmo.
 */
export type Ease = 'smooth' | 'smoother' | 'linear';
/** Janela: a chave vai da pose anterior à pose do capítulo entre `w[0]` e `w[1]` (progresso local). */
interface Window {
  w: readonly [number, number];
  ease?: Ease;
}
/** Keyframes: pares [local, valor]; o 1.º valor deve ser o da pose anterior e o último o da pose do capítulo. */
interface Keyframes {
  k: ReadonlyArray<readonly [number, number]>;
  ease?: Ease;
}
export type Beat = Window | Keyframes;
export type ChapterBeats = Partial<Record<SceneKey, Beat>>;

/**
 * Pose de abertura (p = 0, ato 0): o vírion atravessa o título gigante, girando devagar. Com `fov` 36° a
 * câmera em z = 6,9 enquadra o vírion inteiro (Ø ≈ 2,7 com os espinhos) em ≈ 60 % da altura no desktop
 * (`openingFill`); a frente B desloca o quadro com `viewShift.x ≈ 0,18`. O capítulo 1 aproxima até REST.
 */
export const START: Readonly<SceneState> = Object.freeze({ ...REST, camZ: 6.9, spin: 0.4 });

/** Poses assentadas, uma por capítulo. */
export const POSES: ReadonlyArray<Readonly<SceneState>> = [
  // 1 · O que é: vírion inteiro, perto, girando devagar
  Object.freeze({ ...REST }),
  // 2 · Por dentro: vista explodida completa, rótulos ligados. v4: palco em tela inteira (paisagem, o fov
  // vertical manda): a explosão (meia-altura ≈ 2,7) cabe em ~90 % da altura com a câmera em 9,2
  Object.freeze({ ...REST, camY: 0.35, camZ: 9.2, spin: 0.15, openEnv: 1, openSpikes: 1, openM1: 1, openRnp: 1, labels: 1 }),
  // 3 · Como entra: encaixado, engolido, aberto; RNPs liberadas rumo ao núcleo
  Object.freeze({ ...REST, camX: 0.35, camY: 0.2, camZ: 7.2, lookX: 0.35, virusX: 0.35, spin: 0, membrane: 1, dock: 1, engulf: 1, uncoat: 1, release: 1 }),
  // 4 · Como se espalha: visto de longe; o vírion pegou carona numa gotícula até a boca da silhueta direita
  Object.freeze({ ...REST, camY: 0.3, camZ: 12.5, lookY: 0.3, virusX: CARRY_RIGHT.x, virusY: CARRY_RIGHT.y, virusScale: FAR_SCALE, spin: 0, people: 1, droplets: 1 }),
  // 5 · Vacina: de perto outra vez, coberto de anticorpos; membrana à direita onde ele não encaixou
  // (v4: câmera um pouco mais longe para os anticorpos não encostarem nas bordas do palco em tela inteira)
  Object.freeze({ ...REST, camX: CARRY_RIGHT.x, camY: CARRY_RIGHT.y + 0.15, camZ: 6.4, lookX: CARRY_RIGHT.x, lookY: CARRY_RIGHT.y, virusX: CARRY_RIGHT.x, virusY: CARRY_RIGHT.y, spin: 0.25, membrane: 1, antibodies: 1, block: 1, drift: 1, rebind: 1 }),
];

/**
 * Batidas por capítulo (progresso local 0..1). Passo k de n ocupa [k/n, (k+1)/n]; a batida acontece nos
 * primeiros ~40% do passo e o resto é assentamento (o leitor lê com a cena parada).
 */
export const BEATS: ReadonlyArray<ChapterBeats> = [
  // 1 · 3 passos (0.333 cada)
  {
    camZ: { w: [0, 0.3], ease: 'smoother' },
    spin: { w: [0.15, 0.45] },
    hlHa: { k: [[0.36, 0], [0.44, 1], [0.6, 1], [0.68, 0]] },
    hlNa: { k: [[0.7, 0], [0.78, 1], [0.9, 1], [0.97, 0]] },
  },
  // 2 · 5 passos (0.2 cada): envelope → espinhos → M1/M2 → RNPs + rótulos → assentado (hover)
  {
    spin: { w: [0, 0.15] },
    camZ: { w: [0, 0.7], ease: 'smoother' },
    camY: { w: [0, 0.7], ease: 'smoother' },
    openEnv: { w: [0.02, 0.1], ease: 'smoother' },
    openSpikes: { w: [0.22, 0.31], ease: 'smoother' },
    openM1: { w: [0.42, 0.5], ease: 'smoother' },
    openRnp: { w: [0.62, 0.72], ease: 'smoother' },
    labels: { w: [0.67, 0.75] },
  },
  // 3 · 5 passos: remonta + membrana entra → encaixe → engole → abre (M2) → RNPs saem
  {
    labels: { w: [0, 0.06] },
    openRnp: { w: [0, 0.05] },
    openM1: { w: [0.03, 0.08] },
    openSpikes: { w: [0.05, 0.1] },
    openEnv: { w: [0.07, 0.12] },
    membrane: { w: [0.05, 0.17] },
    camX: { k: [[0.02, 0], [0.2, 1.0], [0.42, 1.0], [0.56, 0.35]] },
    camY: { w: [0.02, 0.2] },
    camZ: { w: [0.02, 0.2] },
    lookX: { k: [[0.02, 0], [0.2, 1.0], [0.42, 1.0], [0.56, 0.35]] },
    virusX: { w: [0.02, 0.2] },
    spin: { w: [0.2, 0.3] },
    dock: { w: [0.24, 0.34], ease: 'smoother' },
    engulf: { w: [0.42, 0.52], ease: 'smoother' },
    uncoat: { w: [0.62, 0.71], ease: 'smoother' },
    release: { w: [0.82, 0.93], ease: 'smoother' },
  },
  // 4 · 4 passos: brota → afasta (pessoas aparecem) → gotículas (o vírion viaja) → assentado
  {
    bud: { k: [[0.02, 0], [0.12, 1], [0.38, 1], [0.48, 0]], ease: 'smoother' },
    membrane: { w: [0.3, 0.45] },
    dock: { w: [0.3, 0.45] },
    engulf: { w: [0.3, 0.45] },
    uncoat: { w: [0.3, 0.45] },
    release: { w: [0.3, 0.45] },
    camX: { w: [0.27, 0.48], ease: 'smoother' },
    camY: { w: [0.27, 0.48], ease: 'smoother' },
    camZ: { w: [0.27, 0.48], ease: 'smoother' },
    lookX: { w: [0.27, 0.48], ease: 'smoother' },
    lookY: { w: [0.27, 0.48], ease: 'smoother' },
    virusScale: { w: [0.27, 0.48], ease: 'smoother' },
    people: { w: [0.33, 0.5] },
    virusX: { k: [[0.27, 0.35], [0.48, CARRY_LEFT.x], [0.52, CARRY_LEFT.x], [0.72, CARRY_RIGHT.x]] },
    virusY: { k: [[0.27, 0], [0.48, CARRY_LEFT.y], [0.52, CARRY_LEFT.y], [0.62, CARRY_LEFT.y + 0.7], [0.72, CARRY_RIGHT.y]] },
    droplets: { w: [0.52, 0.72] },
  },
  // 5 · 5 passos: aproxima (gotícula vira vírion) → anticorpos → não encaixa → deriva → regrudam
  {
    droplets: { w: [0, 0.1] },
    people: { w: [0.06, 0.18] },
    camX: { w: [0.02, 0.18], ease: 'smoother' },
    camY: { w: [0.02, 0.18], ease: 'smoother' },
    camZ: { w: [0.02, 0.18], ease: 'smoother' },
    lookX: { w: [0.02, 0.18], ease: 'smoother' },
    lookY: { w: [0.02, 0.18], ease: 'smoother' },
    virusScale: { w: [0.02, 0.18], ease: 'smoother' },
    spin: { w: [0.1, 0.2] },
    antibodies: { w: [0.22, 0.34], ease: 'smoother' },
    membrane: { w: [0.4, 0.46] },
    block: { w: [0.44, 0.56], ease: 'smoother' },
    drift: { w: [0.62, 0.74], ease: 'smoother' },
    rebind: { w: [0.82, 0.92], ease: 'smoother' },
  },
];

/** Smootherstep de Perlin: 6x⁵ − 15x⁴ + 10x³ (C2; inclinação máxima 1,875). */
export function smootherstep01(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function ease(kind: Ease | undefined, t: number): number {
  const x = clamp01(t);
  if (kind === 'linear') return x;
  if (kind === 'smoother') return smootherstep01(x);
  return smoothstep(0, 1, x);
}

function poseBefore(i: number): Readonly<SceneState> {
  return i === 0 ? START : POSES[i - 1]!;
}

function evalBeat(beat: Beat | undefined, prev: number, next: number, l: number): number {
  if (!beat) return prev === next ? prev : prev + (next - prev) * ease('smooth', (l - 0) / 0.3);
  if ('w' in beat) {
    const [a, b] = beat.w;
    return prev + (next - prev) * ease(beat.ease, (l - a) / Math.max(1e-6, b - a));
  }
  const k = beat.k;
  if (l <= k[0]![0]) return k[0]![1];
  for (let j = 0; j + 1 < k.length; j++) {
    const [t0, v0] = k[j]!;
    const [t1, v1] = k[j + 1]!;
    if (l <= t1) return v0 + (v1 - v0) * ease(beat.ease, (l - t0) / Math.max(1e-6, t1 - t0));
  }
  return k[k.length - 1]![1];
}

/** Capítulo e progresso local a partir do progresso contínuo (satura nas bordas). */
export function chapterFromProgress(progress: number, count: number = CHAPTER_COUNT): { index: number; local: number } {
  if (!Number.isFinite(progress) || progress <= 0) return { index: 0, local: 0 };
  if (progress >= count) return { index: count - 1, local: 1 };
  const index = Math.floor(progress);
  return { index, local: progress - index };
}

/** Estado da cena para um progresso contínuo. */
export function sceneAt(progress: number): SceneState {
  const { index, local } = chapterFromProgress(progress);
  const prev = poseBefore(index);
  const next = POSES[index]!;
  const beats = BEATS[index] ?? {};
  const out = {} as SceneState;
  for (const key of SCENE_KEYS) out[key] = evalBeat(beats[key], prev[key], next[key], local);
  return out;
}

/** Progresso que devolve exatamente a pose assentada do capítulo i (reduced-motion e botões). */
export function settledProgress(i: number): number {
  const idx = Math.max(0, Math.min(CHAPTER_COUNT - 1, Math.floor(i)));
  return idx + 1 - 1e-4;
}

export interface StepRect {
  /** offset do passo em relação ao início do documento (px) */
  top: number;
  height: number;
}

/**
 * Progresso contínuo a partir da posição dos PASSOS de texto no documento. `steps` em ordem de leitura; o
 * capítulo de cada passo vem de `stepsPerChapter`. `refY` = linha de referência (scrollY + deslocamento).
 * Dentro de um passo, a fração é linear até o topo do passo seguinte (ou até o fim do próprio passo, no último).
 */
export function progressFromSteps(refY: number, steps: readonly StepRect[], stepsPerChapter: readonly number[] = STEPS_PER_CHAPTER): number {
  const total = stepsPerChapter.reduce((a, b) => a + b, 0);
  if (steps.length === 0 || total === 0) return 0;
  if (refY < steps[0]!.top) return 0;
  let g = 0;
  for (let i = 0; i < stepsPerChapter.length; i++) {
    const n = stepsPerChapter[i]!;
    for (let k = 0; k < n; k++, g++) {
      const s = steps[g];
      if (!s) return stepsPerChapter.length - 1e-6;
      const nextTop = steps[g + 1]?.top ?? s.top + Math.max(1, s.height);
      if (refY < nextTop) return i + (k + clamp01((refY - s.top) / Math.max(1, nextTop - s.top))) / n;
    }
  }
  return stepsPerChapter.length - 1e-6;
}

/** Campo de visão vertical da câmera do palco (graus). */
export const CAMERA_FOV = 36;
/** Raio aparente do vírion inteiro (envelope + NA, a mais alta) em unidades de cena. */
export const VIRION_EXTENT = 1.36;

/**
 * Fração da ALTURA do quadro ocupada pelo vírion inteiro com a câmera a `distance` do centro (sem
 * `viewShift`, que só desloca a janela). Usada para calibrar a pose de abertura.
 */
export function openingFill(distance: number, fovDeg: number = CAMERA_FOV): number {
  if (!(distance > 0)) return 1;
  return (2 * VIRION_EXTENT) / (2 * distance * Math.tan(((fovDeg / 2) * Math.PI) / 180));
}

/** Fator para afastar a câmera em telas estreitas (mantém o vírion inteiro no quadro). */
export function fitDistance(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return aspect >= 1.25 ? 1 : Math.pow(1.25 / aspect, 0.55);
}

export interface Ambient {
  /** respiração do envelope (−1..1, ~0,25 Hz) */
  breath: number;
  /** oscilação lenta auxiliar (−1..1) */
  wobble: number;
  /** piscar dos canais M2 durante `uncoat` (0..1), a BLINK_HZ (≤ 1 Hz: contrato v4 §6) */
  blink: number;
}

/** Frequência do "pisca" dos canais M2 (Hz). O contrato v4 limita qualquer piscar a 1 Hz. */
export const BLINK_HZ = 0.8;
/** Frequência do realce pulsante de HA/NA no capítulo 1 (Hz; também ≤ 1 Hz). */
export const PULSE_HZ = 0.75;

/** Movimento ambiente, função pura do tempo (s); o `yaw` é integrado pelo driver a partir de `spin`. */
export function ambient(t: number): Ambient {
  const tt = Number.isFinite(t) ? t : 0;
  return {
    breath: Math.sin(tt * Math.PI * 2 * 0.25),
    wobble: Math.sin(tt * Math.PI * 2 * 0.17 + 1.3),
    blink: 0.5 + 0.5 * Math.sin(tt * Math.PI * 2 * BLINK_HZ),
  };
}

/** Velocidade angular (rad/s) do giro ambiente quando `spin` = 1. */
export const SPIN_RATE = 0.22;

/**
 * Deriva ambiente do vírion livre (função pura do tempo; o driver multiplica por `free` ∈ [0, 1], que zera no
 * encaixe e em reduced-motion): leve precessão (inclinação em x/z) e flutuação vertical, em frequências
 * incomensuráveis para o movimento não parecer um laço. Amplitudes pequenas: rad e unidades de cena.
 */
export function drift(t: number): { tiltX: number; tiltZ: number; floatY: number } {
  const tt = Number.isFinite(t) ? t : 0;
  return {
    tiltX: 0.075 * Math.sin(tt * Math.PI * 2 * 0.071 + 0.4),
    tiltZ: 0.05 * Math.sin(tt * Math.PI * 2 * 0.113 + 2.1),
    floatY: 0.04 * Math.sin(tt * Math.PI * 2 * 0.089 + 1.2),
  };
}

/** Núcleo sugerido da célula (quadro micro): destino das RNPs em `release`. */
export const NUCLEUS = { x: 2.7, y: -0.35, z: -1.5 } as const;
/** Raio da vesícula que envolve o vírion em `engulf` (cabe o vírion com espinhos). */
export const VESICLE_RADIUS = 1.5;
/** Posição dos brotos (novos vírions) na face externa da membrana, em `bud` (quadro micro). */
export const BUD_SPOTS: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: 1.1, y: 1.6, z: 0.2 },
  { x: 1.3, y: -1.7, z: -0.3 },
  { x: 0.9, y: 2.3, z: -0.9 },
  { x: 1.5, y: -2.4, z: 0.6 },
  { x: 1.2, y: 1.1, z: -1.3 },
  { x: 1.6, y: -1.2, z: 1.2 },
];
