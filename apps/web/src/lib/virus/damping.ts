/**
 * Amortecimento crítico (SmoothDamp, Unity/Game Programming Gems 4) com limite de velocidade, independente do fps.
 * Usado para suavizar UM escalar: o progresso de rolagem. Puro e testável.
 */
export interface Damped {
  value: number;
  velocity: number;
}

export interface DampOptions {
  /** tempo (s) para cobrir ~63% da distância; menor = mais ágil */
  smoothTime?: number;
  /** velocidade máxima em unidades (capítulos) por segundo */
  maxSpeed?: number;
}

/** Avança `d` em direção a `target` por `dt` segundos (muta e devolve `d`). */
export function dampTo(d: Damped, target: number, dt: number, { smoothTime = 0.35, maxSpeed = 2 }: DampOptions = {}): Damped {
  if (!Number.isFinite(target)) return d;
  if (!Number.isFinite(d.value)) {
    d.value = target;
    d.velocity = 0;
    return d;
  }
  const st = Math.max(1e-4, smoothTime);
  const step = Math.max(0, Math.min(dt, 0.1));
  if (step === 0) return d;
  const omega = 2 / st;
  const x = omega * step;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = d.value - target;
  const maxChange = maxSpeed * st;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const goal = d.value - change;
  const temp = (d.velocity + omega * change) * step;
  d.velocity = (d.velocity - omega * temp) * exp;
  let out = goal + (change + temp) * exp;
  // evita ultrapassar o alvo (garante convergência monótona)
  if (target - d.value > 0 === out > target) {
    out = target;
    d.velocity = 0;
  }
  d.value = out;
  if (Math.abs(d.value - target) < 1e-5 && Math.abs(d.velocity) < 1e-4) {
    d.value = target;
    d.velocity = 0;
  }
  return d;
}

/** Amortecimento exponencial simples, independente do fps (para canais secundários: hover, opacidade). */
export function expDamp(current: number, target: number, dt: number, tau = 0.15): number {
  const k = 1 - Math.exp(-Math.max(0, dt) / Math.max(1e-4, tau));
  const v = current + (target - current) * k;
  return Math.abs(v - target) < 1e-4 ? target : v;
}
