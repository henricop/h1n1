/**
 * Geometria pura da célula-alvo (capítulos 3 a 5), sem three.js: posição da parede de membrana, presença da
 * vesícula, receptores (ácido siálico) e brotos. Tudo no quadro "micro" (vírion na origem, raio 1, espinhos
 * até ≈ 1,4). Testado em test/virus-cell.test.ts.
 *
 * Modelo da endocitose (coerente com o vírion parado na origem): a parede é uma esfera grande (raio
 * CELL_RADIUS) cujo ponto mais próximo do vírion fica em `wallNearX`. Em `engulf` a parede avança para −x e
 * passa pelo vírion; a vesícula (esfera de raio VESICLE_RADIUS na origem) é desenhada só onde está DENTRO da
 * célula e a parede só onde está FORA da vesícula (recorte por fragmento). Visualmente: covinha no ponto de
 * contato → cálice cada vez mais fundo → a vesícula fecha atrás do vírion → parede lisa outra vez, com o
 * vírion dentro da célula. No brotamento (capítulo 4) a parede volta ao ponto de encaixe para os brotos
 * nascerem nos BUD_SPOTS, enquadrados pela câmera.
 */
import { BUD_SPOTS, CONTACT_X, DOCK_GAP, VESICLE_RADIUS } from '@/lib/virus/choreography';
import { clamp01, smoothstep, type Vec3 } from '@/lib/virus/geometry';
import type { SceneState } from '@/lib/virus/scenestate';

/** Raio da célula (unidades micro): enorme perto do vírion (raio 1). */
export const CELL_RADIUS = 6;
/** Deslocamento extra em +x da parede quando `membrane` = 0 (entra deslizando pela direita). */
export const SLIDE_IN = 1.2;
/** Folga entre a vesícula fechada e a parede lisa ao fim de `engulf`. */
export const ENGULF_CLEARANCE = 0.15;
/** Quanto a parede avança em −x durante `engulf` (de CONTACT_X até além da vesícula). */
export const ENGULF_SHIFT = CONTACT_X + VESICLE_RADIUS + ENGULF_CLEARANCE;
/** Seno do semiângulo da calota com receptores (centrada no ponto de contato). */
export const RECEPTOR_CAP_SIN = 0.5;
/** Raio de um broto inflado. */
export const BUD_RADIUS = 0.45;
/** Raio do núcleo sugerido. */
export const NUCLEUS_RADIUS = 1.0;
/** Alcance externo do vírion (pontas dos espinhos), para testes de colisão. */
export const VIRION_OUTER = 1.4;

export type CellInputs = Pick<SceneState, 'membrane' | 'dock' | 'engulf' | 'bud'>;

/**
 * A parede NÃO volta ao ponto de encaixe no brotamento: o vírion engolido continua dentro da vesícula e os
 * brotos nascem na face externa da parede, onde ela está (decisão de integração: evita a parede atravessar o
 * vírion). Mantido como função para os consumidores; sempre 0.
 */
export function budReturn(_bud: number): number {
  return 0;
}

/**
 * Opacidade relativa da parede durante o retorno do brotamento: esmaece no meio do trajeto (a parede atravessa
 * o vírion antigo quase invisível; lê-se como um corte para outro trecho da membrana).
 */
export function wallFade(bud: number): number {
  return 1 - 0.9 * Math.sin(Math.PI * budReturn(bud));
}

/** Presença da vesícula/covinha (0..1): surge no início de `engulf`, some quando a parede volta (brotamento). */
export function vesiclePresence(s: CellInputs): number {
  return smoothstep(0, 0.08, s.engulf) * (1 - budReturn(s.bud));
}

/** x do ponto da parede mais próximo do vírion (quadro micro). */
export function wallNearX(s: CellInputs): number {
  const gap = DOCK_GAP * (1 - clamp01(s.dock));
  const slide = SLIDE_IN * (1 - clamp01(s.membrane));
  const engulfShift = ENGULF_SHIFT * clamp01(s.engulf) * (1 - budReturn(s.bud));
  return CONTACT_X + gap + slide - engulfShift;
}

/** x do centro da esfera da célula (y = z = 0). */
export function cellCenterX(s: CellInputs): number {
  return wallNearX(s) + CELL_RADIUS;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * n direções (unitárias, quadro local da célula) numa calota voltada para −x, em girassol (Vogel): uniformes e
 * ordenadas do centro para a borda — as primeiras são as mais próximas do ponto de contato.
 */
export function receptorDirs(n: number, capSin: number = RECEPTOR_CAP_SIN): Vec3[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('receptorDirs: n deve ser inteiro >= 0');
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const r = capSin * Math.sqrt((i + 0.5) / n);
    const phi = i * GOLDEN_ANGLE;
    out.push({ x: -Math.sqrt(1 - r * r), y: r * Math.cos(phi), z: r * Math.sin(phi) });
  }
  return out;
}

export interface Placement {
  x: number;
  y: number;
  z: number;
  /** direção da haste (unitária) */
  nx: number;
  ny: number;
  nz: number;
  /** 0..1: o receptor está preso à vesícula (encurta a haste) */
  bound: number;
  /** 0..1: visibilidade (0 quando a parede atravessa o vírion) */
  vis: number;
}

export function emptyPlacement(): Placement {
  return { x: 0, y: 0, z: 0, nx: -1, ny: 0, nz: 0, bound: 0, vis: 1 };
}

/**
 * Posição de um receptor (quadro micro). Na parede, aponta para fora da célula. Com a vesícula presente, os
 * receptores cuja coluna (y, z) cruza a vesícula ficam presos ao cálice quando a parede o alcança (ponto da
 * parede = ponto do cálice nesse instante, sem salto) e passam a apontar para o vírion.
 */
export function placeReceptor(dir: Vec3, centerX: number, presence: number, out: Placement): Placement {
  const R = CELL_RADIUS;
  const rv = VESICLE_RADIUS;
  let x = centerX + R * dir.x;
  const y = R * dir.y;
  const z = R * dir.z;
  let nx = dir.x;
  let ny = dir.y;
  let nz = dir.z;
  let bound = 0;
  const rc2 = y * y + z * z;
  if (presence > 0 && rc2 < rv * rv) {
    const cupX = Math.sqrt(rv * rv - rc2);
    if (x < cupX) {
      x += (cupX - x) * presence;
      const turn = presence * smoothstep(0, 0.15, cupX - (centerX + R * dir.x));
      nx += (-cupX / rv - nx) * turn;
      ny += (-y / rv - ny) * turn;
      nz += (-z / rv - nz) * turn;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      bound = turn;
    }
  }
  out.x = x;
  out.y = y;
  out.z = z;
  out.nx = nx;
  out.ny = ny;
  out.nz = nz;
  out.bound = bound;
  out.vis = smoothstep(1.05, 1.3, Math.sqrt(x * x + y * y + z * z));
  return out;
}

export interface BudPhase {
  /** 0..1: inflar (raio = BUD_RADIUS · grow) */
  grow: number;
  /** 0..1: soltar da parede */
  detach: number;
  /** 0..1 → 0: pulso rosa (NA cortando) durante a soltura */
  glow: number;
  /** 0..1: fase do pulso (para o anel crescer) */
  glowT: number;
}

export function emptyBudPhase(): BudPhase {
  return { grow: 0, detach: 0, glow: 0, glowT: 0 };
}

/** Início do broto j de n (em `bud`), escalonado depois do retorno da parede. */
export function budStart(j: number, n: number): number {
  return 0.2 + (n > 1 ? (j * 0.4) / (n - 1) : 0);
}

/** Fase do broto j de n para o valor de `bud`. */
export function budPhase(bud: number, j: number, n: number, out: BudPhase): BudPhase {
  const u = clamp01((bud - budStart(j, n)) / 0.4);
  out.grow = smoothstep(0, 0.65, u);
  out.detach = smoothstep(0.6, 1, u);
  const t = (u - 0.62) / 0.3;
  out.glowT = clamp01(t);
  out.glow = t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0;
  return out;
}

export interface BudSpot {
  y: number;
  z: number;
  /** distância em x do centro da célula até a parede na coluna (y, z): âncora.x = centro.x − off */
  off: number;
  /** normal externa da parede na âncora (independe da posição da célula) */
  n: Vec3;
}

/** Âncoras dos brotos: projeção de BUD_SPOTS (y, z) na parede, com a normal externa. */
export function budSpots(n: number = BUD_SPOTS.length): BudSpot[] {
  const R = CELL_RADIUS;
  return BUD_SPOTS.slice(0, n).map((s) => {
    const off = Math.sqrt(Math.max(0, R * R - s.y * s.y - s.z * s.z));
    return { y: s.y, z: s.z, off, n: { x: -off / R, y: s.y / R, z: s.z / R } };
  });
}

/** Distância do centro do broto à âncora, ao longo da normal (meio embutido → solto com folga). */
export function budOffset(grow: number, detach: number): number {
  const r = BUD_RADIUS * grow;
  return r * (0.5 + 0.5 * detach) + 0.25 * detach;
}
