/**
 * Utilitários geométricos puros do explicador 3D (sem dependência de three.js, testáveis em Node).
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * n pontos distribuídos de forma quase uniforme na esfera unitária (espiral de Fibonacci).
 * Determinístico: a mesma entrada produz sempre os mesmos vetores.
 */
export function fibonacciSphere(n: number): Vec3[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('fibonacciSphere: n deve ser inteiro >= 0');
  const out: Vec3[] = [];
  if (n === 0) return out;
  if (n === 1) return [{ x: 0, y: 1, z: 0 }];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n; // de +1 a -1, sem tocar os polos
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    out.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return out;
}

export function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function distance(a: Vec3, b: Vec3): number {
  return length({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
}

export function scale(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Transição suave 0→1 entre `edge0` e `edge1` (Hermite). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Gerador pseudoaleatório determinístico (mulberry32) para espalhamentos estáveis entre renderizações. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pontos de uma hélice ao longo do eixo y, centrada na origem.
 * `turns` voltas, raio `radius`, comprimento total `height`, `samples` pontos.
 */
export function helixPoints(turns: number, radius: number, height: number, samples: number, phase = 0): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < samples; i++) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    const a = phase + t * turns * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, y: (t - 0.5) * height, z: Math.sin(a) * radius });
  }
  return pts;
}

/**
 * Os 8 segmentos de RNA do influenza A, com o comprimento relativo usado só para proporção visual
 * (do maior, PB2, ao menor, NS). Nomes padronizados da literatura; não são números exibidos como dado.
 */
export const RNA_SEGMENTS: ReadonlyArray<{ name: string; relLength: number }> = [
  { name: 'PB2', relLength: 1 },
  { name: 'PB1', relLength: 1 },
  { name: 'PA', relLength: 0.95 },
  { name: 'HA', relLength: 0.76 },
  { name: 'NP', relLength: 0.67 },
  { name: 'NA', relLength: 0.6 },
  { name: 'M', relLength: 0.44 },
  { name: 'NS', relLength: 0.38 },
];
