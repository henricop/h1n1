/**
 * EARS (Early Aberration Reporting System, CDC) — algoritmos C1, C2 e C3 adaptados a séries semanais.
 *
 * Referência: Hutwagner L. et al., "The bioterrorism preparedness and response Early Aberration Reporting
 * System (EARS)", J Urban Health 2003; e a implementação de referência do projeto MIT ears-outbreak-detector.
 *
 * Para cada posição t da série:
 * - C1 = (x_t − média(baseline)) / sd(baseline), com baseline = as `baseline` semanas imediatamente
 *   anteriores a t (sem guarda).
 * - C2 = idem, mas a baseline termina `guard` semanas antes de t (janela [t − guard − baseline, t − guard)).
 * - C3 = Σ_{i=0..2} max(0, C2(t − i) − 1): acumula excessos recentes de C2.
 *
 * Convenções:
 * - sd = desvio-padrão amostral (n − 1). sd zero → estatística 0 se x_t ≤ média, senão 100.
 * - Valores `null` são tratados como ausentes: são pulados na baseline; se x_t é null, o resultado em t é null.
 * - Posições sem baseline completa (índices fora da série, ou menos de 2 valores não nulos na janela) têm a
 *   estatística correspondente null; posições sem C1 nem C2 computáveis, ou com x_t null, saem como null.
 * - Sinal ("flag") quando a estatística excede o limiar (C1 > 3, C2 > 3, C3 > 2 por padrão).
 *
 * É um sinal estatístico de aberração, não um surto confirmado. Semanas provisórias (atraso de notificação)
 * subestimam o valor e, portanto, o sinal.
 */

export type EarsFlag = 'C1' | 'C2' | 'C3';

export interface EarsThresholds {
  c1: number;
  c2: number;
  c3: number;
}

export interface EarsOptions {
  /** semanas da baseline (default 8) */
  baseline?: number;
  /** semanas de guarda entre a baseline e t em C2 (default 2) */
  guard?: number;
  /** limiares de sinal (default c1: 3, c2: 3, c3: 2) */
  thresholds?: Partial<EarsThresholds>;
}

export interface EarsPoint {
  c1: number | null;
  c2: number | null;
  c3: number | null;
  flags: EarsFlag[];
}

export const EARS_DEFAULTS = { baseline: 8, guard: 2, thresholds: { c1: 3, c2: 3, c3: 2 } } as const;

/** Estatística padronizada de uma janela; null se a janela não cabe na série ou tem < 2 valores não nulos. */
function zscore(values: readonly (number | null)[], t: number, start: number, end: number): number | null {
  if (start < 0 || end > t) return null;
  const x = values[t];
  if (x === null || x === undefined) return null;
  const win: number[] = [];
  for (let i = start; i < end; i++) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) win.push(v);
  }
  if (win.length < 2) return null;
  const mean = win.reduce((a, b) => a + b, 0) / win.length;
  const variance = win.reduce((a, b) => a + (b - mean) ** 2, 0) / (win.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return x <= mean ? 0 : 100;
  return (x - mean) / sd;
}

const round = (v: number | null): number | null => (v === null ? null : Math.round(v * 1000) / 1000);

/**
 * Calcula C1, C2, C3 e os sinais por posição da série (mesmo comprimento de `values`).
 * Posições sem baseline completa ou com valor nulo saem como `null`.
 */
export function ears(values: readonly (number | null)[], opts: EarsOptions = {}): (EarsPoint | null)[] {
  const baseline = Math.max(2, Math.floor(opts.baseline ?? EARS_DEFAULTS.baseline));
  const guard = Math.max(0, Math.floor(opts.guard ?? EARS_DEFAULTS.guard));
  const th: EarsThresholds = { ...EARS_DEFAULTS.thresholds, ...(opts.thresholds ?? {}) };
  const n = values.length;
  const c1: (number | null)[] = new Array(n).fill(null);
  const c2: (number | null)[] = new Array(n).fill(null);
  for (let t = 0; t < n; t++) {
    c1[t] = zscore(values, t, t - baseline, t);
    c2[t] = zscore(values, t, t - guard - baseline, t - guard);
  }
  const out: (EarsPoint | null)[] = new Array(n).fill(null);
  for (let t = 0; t < n; t++) {
    const x = values[t];
    if (x === null || x === undefined) continue;
    const a = c1[t] ?? null;
    const b = c2[t] ?? null;
    if (a === null && b === null) continue;
    let c3: number | null = null;
    if (t >= 2 && c2[t] !== null && c2[t - 1] !== null && c2[t - 2] !== null) {
      c3 = 0;
      for (let i = 0; i < 3; i++) c3 += Math.max(0, (c2[t - i] as number) - 1);
    }
    const flags: EarsFlag[] = [];
    if (a !== null && a > th.c1) flags.push('C1');
    if (b !== null && b > th.c2) flags.push('C2');
    if (c3 !== null && c3 > th.c3) flags.push('C3');
    out[t] = { c1: round(a), c2: round(b), c3: round(c3), flags };
  }
  return out;
}
