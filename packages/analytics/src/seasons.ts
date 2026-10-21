/**
 * Sobreposição de temporadas: reorganiza uma série semanal (`AAAA-Www`) em uma linha por ano, com uma
 * coluna por semana 1..53, para comparar o formato da curva de cada temporada.
 *
 * Semanas sem observação ficam `null`. Pontos com período fora do formato semanal são ignorados.
 * A semana 53 só existe em alguns anos; nos demais fica `null`.
 */

export interface SeasonPoint {
  period: string;
  value: number | null;
}

export interface SeasonSeries {
  year: number;
  /** 53 posições: índice i → semana i + 1 */
  values: (number | null)[];
}

export interface SeasonOverlay {
  /** 1..53 */
  weeks: number[];
  /** ordenado por ano crescente */
  seasons: SeasonSeries[];
}

export const SEASON_WEEKS = 53;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;

export function seasonOverlay(points: readonly SeasonPoint[]): SeasonOverlay {
  const byYear = new Map<number, (number | null)[]>();
  for (const p of points) {
    const m = WEEK_RE.exec(p.period);
    if (!m) continue;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (week < 1 || week > SEASON_WEEKS) continue;
    let row = byYear.get(year);
    if (!row) {
      row = new Array<number | null>(SEASON_WEEKS).fill(null);
      byYear.set(year, row);
    }
    row[week - 1] = p.value;
  }
  const seasons = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, values]) => ({ year, values }));
  return { weeks: Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1), seasons };
}
