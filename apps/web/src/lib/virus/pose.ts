/**
 * Matemática de posição das peças do vírion (fonte única para Virion, Labels e Antibodies). Puro, sem WebGL.
 * Quadro local do grupo do vírion: raio nominal do envelope = 1 (≈ 55 nm). O envelope é pleomórfico
 * (`envelopeRadius`), abre em dois hemisférios (y ≥ 0 sobe, y < 0 desce) e cada espinho acompanha o seu
 * hemisfério. Proporções: docs/pesquisa/explicador-3d-virion.md (Harris 2006; Noda 2012).
 */
import { RNA_SEGMENTS, clamp01, fibonacciSphere, seededRandom, type Vec3 } from './geometry';
import { simplex3 } from './noise';
import type { PartId } from './parts';
import type { SceneState } from './scenestate';

export type Quality = 'low' | 'high';
export type SpikeKind = 'ha' | 'na' | 'm2';

export interface SpikeLayout {
  ha: Vec3[];
  na: Vec3[];
  m2: Vec3[];
}

/** Altura do topo da HA e da NA acima da membrana (unid. de cena; HA ≈ 14 nm, NA ≈ 16 nm — NA mais alta). */
export const HA_HEIGHT = 0.28;
export const NA_HEIGHT = 0.36;
export const M2_HEIGHT = 0.12;
/** Quanto a base do espinho fica enterrada na bicamada. */
export const SPIKE_SINK = 0.02;
/** Deslocamento de cada hemisfério do envelope quando totalmente aberto. */
export const HALF_SHIFT = 0.78;
/** Elevação radial dos espinhos quando totalmente abertos. */
export const SPIKE_LIFT = 0.55;
/** Camada M1: raio nominal (logo abaixo do envelope) e deslocamento de cada metade quando aberta. */
export const M1_RADIUS = 0.9;
export const M1_SHIFT = 0.34;

/** Contagens por qualidade (razão ≈ 7 HA : 1 NA; M2 poucos e discretos). */
export const SPIKE_COUNTS: Record<Quality, Record<SpikeKind, number>> = {
  high: { ha: 140, na: 20, m2: 8 },
  low: { ha: 70, na: 10, m2: 6 },
};

/** Ruído do envelope pleomórfico: duas oitavas de baixa frequência, amplitude total ±6 %. */
export const ENVELOPE_NOISE = { amp1: 0.045, freq1: 1.7, amp2: 0.015, freq2: 4.0 } as const;

/** Manchas sem espinhos (direção unitária + raio angular, rad), ≈ 2 % da esfera cada. */
export const BALD_PATCHES: ReadonlyArray<{ dir: Vec3; radius: number }> = [
  { dir: norm({ x: 0.3, y: 0.55, z: -0.78 }), radius: 0.3 },
  { dir: norm({ x: -0.8, y: -0.35, z: 0.45 }), radius: 0.27 },
  { dir: norm({ x: 0.15, y: -0.95, z: 0.28 }), radius: 0.25 },
];

/** Deriva antigênica: a cabeça i da HA é "drifted" se o i-ésimo valor de seededRandom(DRIFT_SEED) < DRIFT_FRACTION. */
export const DRIFT_SEED = 29;
export const DRIFT_FRACTION = 0.35;

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function rotY(d: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: d.x * c + d.z * s, y: d.y, z: -d.x * s + d.z * c };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Raio do envelope na direção `dir` (unitária). A MESMA função desloca a malha e posiciona os espinhos. */
export function envelopeRadius(dir: Vec3): number {
  const { amp1, freq1, amp2, freq2 } = ENVELOPE_NOISE;
  const n1 = simplex3(dir.x * freq1 + 3.1, dir.y * freq1 + 7.7, dir.z * freq1 + 1.9);
  const n2 = simplex3(dir.x * freq2 - 5.3, dir.y * freq2 + 2.2, dir.z * freq2 - 8.6);
  return 1 + amp1 * n1 + amp2 * n2;
}

/** Máscara de deriva por índice de HA (compartilhada com os anticorpos: mesma semente, mesma regra). */
export function driftMask(count: number): boolean[] {
  const rnd = seededRandom(DRIFT_SEED);
  return Array.from({ length: count }, () => rnd() < DRIFT_FRACTION);
}

function inBaldPatch(d: Vec3): boolean {
  for (const p of BALD_PATCHES) if (dot(d, p.dir) > Math.cos(p.radius)) return true;
  return false;
}

/** Direções quase uniformes com jitter tangencial determinístico (empacotamento denso e irregular). */
function jittered(count: number, seed: number, amount: number, twist: number): Vec3[] {
  const rnd = seededRandom(seed);
  const spacing = Math.sqrt((4 * Math.PI) / Math.max(1, count));
  return fibonacciSphere(count).map((d0) => {
    const d = rotY(d0, twist);
    const ref = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const t1 = norm({ x: ref.y * d.z - ref.z * d.y, y: ref.z * d.x - ref.x * d.z, z: ref.x * d.y - ref.y * d.x });
    const t2 = { x: d.y * t1.z - d.z * t1.y, y: d.z * t1.x - d.x * t1.z, z: d.x * t1.y - d.y * t1.x };
    const a = (rnd() - 0.5) * 2 * amount * spacing;
    const b = (rnd() - 0.5) * 2 * amount * spacing;
    return norm({ x: d.x + t1.x * a + t2.x * b, y: d.y + t1.y * a + t2.y * b, z: d.z + t1.z * a + t2.z * b });
  });
}

/** Separação angular mínima entre espinhos (cabeças ≈ 0,16 de largura a r ≈ 1,2). */
export const SPIKE_MIN_SEP = 0.13;

/** Relaxação determinística: afasta pares mais próximos que `minSep` (tangencialmente), poucas iterações. */
function relax(dirs: Vec3[], minSep: number, iters: number): void {
  const cosMin = Math.cos(minSep);
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const a = dirs[i]!;
        const b = dirs[j]!;
        const d = dot(a, b);
        if (d <= cosMin) continue;
        const ang = Math.acos(Math.min(1, d));
        const push = (minSep - ang) * 0.55 + 1e-3;
        // direção tangencial de a afastando-se de b (e vice-versa)
        const ab = norm({ x: b.x - a.x * d, y: b.y - a.y * d, z: b.z - a.z * d });
        dirs[i] = norm({ x: a.x - ab.x * push, y: a.y - ab.y * push, z: a.z - ab.z * push });
        dirs[j] = norm({ x: b.x + ab.x * push, y: b.y + ab.y * push, z: b.z + ab.z * push });
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/**
 * Direções (unitárias) de HA, NA e M2, determinísticas por qualidade: candidatos densos e irregulares (jitter +
 * relaxação), menos as manchas calvas; NA em ilhas de 2–4 mais algumas isoladas; o resto é HA. Contagens exatas
 * de SPIKE_COUNTS.
 */
export function spikeLayout(quality: Quality): SpikeLayout {
  const c = SPIKE_COUNTS[quality];
  const want = c.ha + c.na;
  const rnd = seededRandom(quality === 'high' ? 11 : 13);
  const pool = jittered(Math.ceil(want * 1.22), 17, 0.33, 0.37).filter((d) => !inBaldPatch(d));
  while (pool.length > want) pool.splice(Math.floor(rnd() * pool.length), 1);
  relax(pool, SPIKE_MIN_SEP, 8);
  for (let i = pool.length - 1; i >= 0; i--) if (inBaldPatch(pool[i]!)) pool.splice(i, 1);
  while (pool.length < want) {
    // repõe (raro) o que a relaxação empurrou para uma mancha calva
    const extra = jittered(want, 19 + pool.length, 0.33, 0.37 + pool.length).filter((d) => !inBaldPatch(d) && pool.every((p) => dot(p, d) < Math.cos(SPIKE_MIN_SEP)));
    if (extra.length === 0) break;
    pool.push(extra[0]!);
  }

  const isNa = new Array<boolean>(pool.length).fill(false);
  let naLeft = Math.min(c.na, pool.length);
  const islands = Math.max(1, Math.round((c.na * 0.6) / 3));
  for (let k = 0; k < islands && naLeft > 0; k++) {
    const free = pool.map((_, i) => i).filter((i) => !isNa[i]);
    if (free.length === 0) break;
    const seedIdx = free[Math.floor(rnd() * free.length)]!;
    const size = Math.min(naLeft, 2 + Math.floor(rnd() * 3));
    const seed = pool[seedIdx]!;
    const near = free.filter((i) => i !== seedIdx).sort((a, b) => dot(pool[b]!, seed) - dot(pool[a]!, seed));
    isNa[seedIdx] = true;
    naLeft--;
    for (let j = 0; j < size - 1 && naLeft > 0; j++) {
      const i = near[j];
      if (i === undefined) break;
      isNa[i] = true;
      naLeft--;
    }
  }
  while (naLeft > 0) {
    const free = pool.map((_, i) => i).filter((i) => !isNa[i]);
    if (free.length === 0) break;
    isNa[free[Math.floor(rnd() * free.length)]!] = true;
    naLeft--;
  }
  const ha: Vec3[] = [];
  const na: Vec3[] = [];
  pool.forEach((d, i) => (isNa[i] ? na : ha).push(d));
  // M2: poucos, discretos, no vão entre espinhos (≥ 0,09 rad de qualquer HA/NA) e fora das manchas calvas
  const cosGap = Math.cos(0.09);
  const m2 = jittered(c.m2 * 3, 23, 0.25, 2.1)
    .filter((d) => !inBaldPatch(d) && pool.every((p) => dot(p, d) < cosGap))
    .slice(0, c.m2);
  return { ha, na, m2 };
}

/** Sinal do hemisfério a que a direção pertence (+1 topo, −1 base). */
export function hemisphere(dir: Vec3): 1 | -1 {
  return dir.y >= 0 ? 1 : -1;
}

/** Elevação radial de cada família ao abrir (HA primeiro; NA e M2 com atraso, NA vai mais longe). */
export function spikeLift(kind: SpikeKind, openSpikes: number): number {
  if (kind === 'na') return clamp01((openSpikes - 0.2) / 0.8) * SPIKE_LIFT * 1.15;
  if (kind === 'm2') return clamp01((openSpikes - 0.1) / 0.9) * SPIKE_LIFT * 0.8;
  return clamp01(openSpikes / 0.85) * SPIKE_LIFT;
}

/** Versão sem alocação de `spikeBase` (escreve em `out`). */
export function spikeBaseInto(kind: SpikeKind, dir: Vec3, s: Pick<SceneState, 'openSpikes' | 'openEnv'>, out: Vec3): Vec3 {
  const r = envelopeRadius(dir) - SPIKE_SINK + spikeLift(kind, s.openSpikes);
  const lift = hemisphere(dir) * s.openEnv * HALF_SHIFT;
  out.x = dir.x * r;
  out.y = dir.y * r + lift;
  out.z = dir.z * r;
  return out;
}

/** Posição da base de um espinho no quadro do vírion, dado o estado (acompanha o hemisfério ao abrir). */
export function spikeBase(kind: SpikeKind, dir: Vec3, s: Pick<SceneState, 'openSpikes' | 'openEnv'>): Vec3 {
  return spikeBaseInto(kind, dir, s, { x: 0, y: 0, z: 0 });
}

export function spikeHeight(kind: SpikeKind): number {
  return kind === 'ha' ? HA_HEIGHT : kind === 'na' ? NA_HEIGHT : M2_HEIGHT;
}

/** Topo (cabeça) de um espinho no quadro do vírion. */
export function spikeTop(kind: SpikeKind, dir: Vec3, s: Pick<SceneState, 'openSpikes' | 'openEnv'>): Vec3 {
  const b = spikeBase(kind, dir, s);
  const h = spikeHeight(kind);
  return { x: b.x + dir.x * h, y: b.y + dir.y * h, z: b.z + dir.z * h };
}

// ---------------------------------------------------------------------------------------------------------
// RNPs: 8 bastonetes (3 longos parecidos + 5 mais curtos), arranjo 7+1 com o central longo; leque escalonado.

export const RNP_COUNT = 8;
/** Raio do anel dos 7 periféricos em repouso. */
export const RNP_RING = 0.42;
/** Atraso entre RNPs consecutivas na abertura em leque (RNP k começa em openRnp = k·RNP_STAGGER). */
export const RNP_STAGGER = 0.06;
/** Posição do leque (frente do vírion) quando totalmente aberto. */
export const RNP_FAN = { spread: 0.42, y: -0.1, z: 1.5, tilt: 0.11 } as const;

/** Comprimento (unid. de cena) da RNP k, proporcional ao segmento; cabe dentro de M1 (raio 0,9). */
export function rnpLength(k: number): number {
  const rel = RNA_SEGMENTS[k]?.relLength ?? 0.5;
  return 0.5 + 0.95 * rel;
}

/** Centro da RNP k em repouso (7+1, eixo y): k = 0 central. */
export function rnpRestCenter(k: number): Vec3 {
  if (k === 0) return { x: 0, y: 0, z: 0 };
  const a = ((k - 1) / 7) * Math.PI * 2;
  return { x: Math.cos(a) * RNP_RING, y: 0, z: Math.sin(a) * RNP_RING };
}

/** Centro da RNP k no leque aberto. */
export function rnpFanCenter(k: number): Vec3 {
  return { x: (k - (RNP_COUNT - 1) / 2) * RNP_FAN.spread, y: RNP_FAN.y, z: RNP_FAN.z };
}

/** Progresso individual (0..1) da RNP k para um `openRnp` global, com escalonamento. */
export function rnpOpenT(openRnp: number, k: number): number {
  const span = 1 - (RNP_COUNT - 1) * RNP_STAGGER;
  return clamp01((openRnp - k * RNP_STAGGER) / span);
}

/** Progresso individual (0..1) da RNP k ao sair em fila rumo ao núcleo (`release`). */
export function rnpReleaseT(release: number, k: number): number {
  const stagger = 0.07;
  const span = 1 - (RNP_COUNT - 1) * stagger;
  return clamp01((release - k * stagger) / span);
}

function closest(dirs: readonly Vec3[], t: Vec3): Vec3 {
  let best = dirs[0] ?? { x: 0, y: 1, z: 0 };
  let bd = -Infinity;
  for (const d of dirs) {
    const dd = dot(d, t);
    if (dd > bd) {
      bd = dd;
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
    case 'envelope': {
      const up = { x: 0, y: 1, z: 0 };
      return { x: 0, y: envelopeRadius(up) + 0.1 + s.openEnv * HALF_SHIFT, z: 0 };
    }
    case 'm1':
      return { x: -0.55, y: M1_RADIUS * 0.22 + s.openM1 * M1_SHIFT, z: M1_RADIUS * 0.78 };
    case 'rna':
    default:
      return { x: 0, y: -0.75, z: 0.4 + s.openRnp * (RNP_FAN.z - 0.25) };
  }
}
