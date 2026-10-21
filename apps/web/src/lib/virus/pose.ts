/**
 * Matemática de posição das peças do vírion (fonte única para Virion, Labels e Antibodies). Puro, sem WebGL.
 * Quadro local do grupo do vírion: raio nominal do envelope = 1 (≈ 55 nm). O envelope abre em dois hemisférios
 * (y ≥ 0 sobe, y < 0 desce) e cada espinho acompanha o seu hemisfério.
 */
import { fibonacciSphere, type Vec3 } from './geometry';
import type { PartId } from './parts';
import type { SceneState } from './scenestate';

export type Quality = 'low' | 'high';
export type SpikeKind = 'ha' | 'na' | 'm2';

export interface SpikeLayout {
  ha: Vec3[];
  na: Vec3[];
  m2: Vec3[];
}

/** Altura do topo da HA e da NA acima da membrana (unid. de cena; HA ≈ 14 nm, NA ≈ 16 nm). */
export const HA_HEIGHT = 0.3;
export const NA_HEIGHT = 0.42;
/** Deslocamento de cada hemisfério do envelope quando totalmente aberto. */
export const HALF_SHIFT = 0.78;
/** Elevação radial dos espinhos quando totalmente abertos. */
export const SPIKE_LIFT = 0.55;

export const SPIKE_COUNTS: Record<Quality, Record<SpikeKind, number>> = {
  high: { ha: 90, na: 16, m2: 8 },
  low: { ha: 50, na: 10, m2: 6 },
};

function rotY(d: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: d.x * c + d.z * s, y: d.y, z: -d.x * s + d.z * c };
}

/** Raio do envelope na direção `dir` (1 = esfera perfeita; o vírion pleomórfico substitui por ruído). */
export function envelopeRadius(_dir: Vec3): number {
  return 1;
}

/** Direções (unitárias) de HA, NA e M2, determinísticas por qualidade. */
export function spikeLayout(quality: Quality): SpikeLayout {
  const c = SPIKE_COUNTS[quality];
  return {
    ha: fibonacciSphere(c.ha),
    na: fibonacciSphere(c.na).map((d) => rotY(d, 0.9)),
    m2: fibonacciSphere(c.m2).map((d) => rotY(d, 2.1)),
  };
}

/** Sinal do hemisfério a que a direção pertence (+1 topo, −1 base). */
export function hemisphere(dir: Vec3): 1 | -1 {
  return dir.y >= 0 ? 1 : -1;
}

/** Posição da base de um espinho no quadro do vírion, dado o estado (acompanha o hemisfério ao abrir). */
export function spikeBase(kind: SpikeKind, dir: Vec3, s: Pick<SceneState, 'openSpikes' | 'openEnv'>): Vec3 {
  const r = envelopeRadius(dir) - 0.02 + s.openSpikes * SPIKE_LIFT * (kind === 'na' ? 1.15 : kind === 'm2' ? 0.8 : 1);
  const lift = hemisphere(dir) * s.openEnv * HALF_SHIFT;
  return { x: dir.x * r, y: dir.y * r + lift, z: dir.z * r };
}

/** Topo (cabeça) de um espinho no quadro do vírion. */
export function spikeTop(kind: SpikeKind, dir: Vec3, s: Pick<SceneState, 'openSpikes' | 'openEnv'>): Vec3 {
  const b = spikeBase(kind, dir, s);
  const h = kind === 'ha' ? HA_HEIGHT : kind === 'na' ? NA_HEIGHT : 0.12;
  return { x: b.x + dir.x * h, y: b.y + dir.y * h, z: b.z + dir.z * h };
}

function closest(dirs: readonly Vec3[], t: Vec3): Vec3 {
  let best = dirs[0] ?? { x: 0, y: 1, z: 0 };
  let bd = -Infinity;
  for (const d of dirs) {
    const dot = d.x * t.x + d.y * t.y + d.z * t.z;
    if (dot > bd) {
      bd = dot;
      best = d;
    }
  }
  return best;
}

/** Ponto de ancoragem do rótulo de cada peça, no quadro do vírion. */
export function partAnchor(id: PartId, s: Readonly<SceneState>, layout: SpikeLayout): Vec3 {
  switch (id) {
    case 'ha': {
      const t = spikeTop('ha', closest(layout.ha, { x: -0.55, y: 0.6, z: 0.55 }), s);
      return { x: t.x * 1.08, y: t.y * 1.08, z: t.z * 1.08 };
    }
    case 'na': {
      const t = spikeTop('na', closest(layout.na, { x: 0.7, y: -0.35, z: 0.6 }), s);
      return { x: t.x * 1.08, y: t.y * 1.08, z: t.z * 1.08 };
    }
    case 'm2': {
      const t = spikeTop('m2', closest(layout.m2, { x: 0.6, y: 0.5, z: 0.6 }), s);
      return { x: t.x * 1.1, y: t.y * 1.1, z: t.z * 1.1 };
    }
    case 'envelope':
      return { x: 0, y: 1.1 + s.openEnv * HALF_SHIFT, z: 0 };
    case 'm1':
      return { x: -0.55, y: 0.2 + s.openM1 * 0.34, z: 0.7 };
    case 'rna':
    default:
      return { x: 0, y: -0.75, z: 0.4 + s.openRnp * 1.25 };
  }
}
