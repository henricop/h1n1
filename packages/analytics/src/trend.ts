/**
 * Tendência: variação percentual entre a média das últimas `k` posições e a média das `k` posições
 * imediatamente anteriores.
 *
 * - Valores `null` são ignorados dentro de cada janela (média sobre os presentes).
 * - Retorna `null` quando a série tem menos de 2k posições, quando alguma das janelas não tem valor, ou
 *   quando a média anterior é zero (variação indefinida).
 * - Resultado em pontos percentuais relativos (ex.: 25 = +25 %), arredondado a 1 casa.
 */
export function trend(values: readonly (number | null)[], k: number): number | null {
  const w = Math.floor(k);
  if (!(w >= 1) || values.length < 2 * w) return null;
  const mean = (arr: readonly (number | null)[]): number | null => {
    const xs = arr.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const recent = mean(values.slice(values.length - w));
  const previous = mean(values.slice(values.length - 2 * w, values.length - w));
  if (recent === null || previous === null || previous === 0) return null;
  return Math.round(((recent - previous) / previous) * 1000) / 10;
}
