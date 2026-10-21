/**
 * Nowcast simples por distribuição empírica de atraso de notificação.
 *
 * Dado o número observado (já digitado) de uma semana que terminou há `weeksAgo` semanas e a proporção
 * acumulada `cdf[d]` (em %) de registros digitados até d semanas após o início dos sintomas, a estimativa do
 * total final é observed / share, com share = cdf[min(weeksAgo, 12)] / 100.
 *
 * Intervalo: erro padrão binomial da proporção, se = sqrt(p(1 − p) / n), onde n é o número de registros usados
 * para estimar a CDF. lower = observed / min(1, p + 1.96·se); upper = observed / max(0.02, p − 1.96·se).
 * Quando share ≥ 0.98 a semana é considerada completa: estimated = observed, sem intervalo.
 *
 * **É uma estimativa**, não uma contagem: assume que o atraso das últimas semanas segue a distribuição da
 * janela de referência (52 semanas anteriores), o que falha em mudanças de rotina de digitação, feriados
 * e picos epidêmicos. O intervalo cobre só a incerteza da proporção, não a variabilidade do próprio processo.
 */

export interface NowcastInput {
  period: string;
  /** valor observado (digitado) da semana; null = sem dado */
  value: number | null;
  /** semanas decorridas entre a semana do período e a data da base (0 = semana corrente) */
  weeksAgo: number;
}

export interface NowcastPoint {
  period: string;
  weeks_ago: number;
  observed: number | null;
  /** proporção (0–1) dos registros que já teriam sido digitados dado o atraso típico */
  reported_share: number | null;
  /** observed / reported_share; igual a observed quando a semana é considerada completa (share ≥ 0.98) */
  estimated: number | null;
  lower: number | null;
  upper: number | null;
}

/** share a partir do qual a semana é tratada como completa (sem correção nem intervalo) */
export const NOWCAST_COMPLETE_SHARE = 0.98;
/** share mínimo para corrigir (abaixo disso a divisão explode e a estimativa não é publicada) */
export const NOWCAST_MIN_SHARE = 0.02;
export const NOWCAST_MAX_DELAY_WEEKS = 12;

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * @param observed pontos observados
 * @param cdf 13 valores (d = 0..12) em percentual acumulado (0–100), não decrescentes
 * @param n número de registros que originaram a CDF (para o erro padrão); n ≤ 0 → sem intervalo
 */
export function nowcast(observed: readonly NowcastInput[], cdf: readonly number[], n: number): NowcastPoint[] {
  if (cdf.length < NOWCAST_MAX_DELAY_WEEKS + 1) {
    throw new Error(`cdf precisa de ${NOWCAST_MAX_DELAY_WEEKS + 1} valores (d = 0..${NOWCAST_MAX_DELAY_WEEKS}); recebeu ${cdf.length}`);
  }
  return observed.map((o) => {
    const weeksAgo = Math.max(0, Math.floor(o.weeksAgo));
    const d = Math.min(weeksAgo, NOWCAST_MAX_DELAY_WEEKS);
    const raw = cdf[d];
    const share = raw === undefined || !Number.isFinite(raw) ? null : Math.min(1, Math.max(0, raw / 100));
    const base: NowcastPoint = {
      period: o.period,
      weeks_ago: weeksAgo,
      observed: o.value,
      reported_share: share === null ? null : Math.round(share * 10000) / 10000,
      estimated: null,
      lower: null,
      upper: null,
    };
    if (o.value === null || share === null) return base;
    if (share >= NOWCAST_COMPLETE_SHARE) return { ...base, estimated: o.value };
    if (share < NOWCAST_MIN_SHARE) return base;
    const estimated = r1(o.value / share);
    if (!(n > 0)) return { ...base, estimated };
    const se = Math.sqrt((share * (1 - share)) / n);
    const lower = r1(o.value / Math.min(1, share + 1.96 * se));
    const upper = r1(o.value / Math.max(NOWCAST_MIN_SHARE, share - 1.96 * se));
    return { ...base, estimated, lower, upper };
  });
}
