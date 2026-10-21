/**
 * Sobreposição de temporadas: reorganiza uma série semanal (`AAAA-Www`) em uma linha por temporada, com
 * 53 posições, para comparar o formato da curva de cada temporada.
 *
 * Dois agrupamentos:
 * - `calendar` (padrão): uma linha por ano civil/epidemiológico, posições = semana 1..53; rótulo `2025`.
 * - `season`: uma linha por temporada de influenza do hemisfério sul, da SE 27 de um ano à SE 26 do ano
 *   seguinte, posições = semanas 27..53 do ano inicial e 1..26 do seguinte; rótulo `2025/26`; `year` é o
 *   ano inicial.
 *
 * Semanas sem observação ficam `null`. Pontos com período fora do formato semanal são ignorados.
 * A semana 53 só existe em alguns anos; nos demais a posição fica `null`.
 */

export interface SeasonPoint {
  period: string;
  value: number | null;
}

export type SeasonGroup = 'calendar' | 'season';

export interface SeasonSeries {
  /** ano civil (`calendar`) ou ano inicial da temporada (`season`) */
  year: number;
  /** `2025` (calendar) ou `2025/26` (season) */
  label: string;
  /** 53 posições: índice i → weeks[i] */
  values: (number | null)[];
}

export interface SeasonOverlay {
  group: SeasonGroup;
  /** eixo de 53 semanas: 1..53 (calendar) ou 27..53,1..26 (season) */
  weeks: number[];
  /** ordenado por ano crescente */
  seasons: SeasonSeries[];
}

export const SEASON_WEEKS = 53;
/** Primeira semana da temporada no agrupamento `season` (SE 27 → SE 26 do ano seguinte). */
export const SEASON_START_WEEK = 27;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;

const CALENDAR_AXIS = Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1);
const SEASON_AXIS = [
  ...Array.from({ length: SEASON_WEEKS - SEASON_START_WEEK + 1 }, (_, i) => SEASON_START_WEEK + i),
  ...Array.from({ length: SEASON_START_WEEK - 1 }, (_, i) => i + 1),
];

/** Rótulo da temporada: `2025/26`. */
export function seasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function seasonOverlay(points: readonly SeasonPoint[], opts: { group?: SeasonGroup } = {}): SeasonOverlay {
  const group: SeasonGroup = opts.group ?? 'calendar';
  const byYear = new Map<number, (number | null)[]>();
  for (const p of points) {
    const m = WEEK_RE.exec(p.period);
    if (!m) continue;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (week < 1 || week > SEASON_WEEKS) continue;
    let key = year;
    let idx = week - 1;
    if (group === 'season') {
      if (week >= SEASON_START_WEEK) {
        idx = week - SEASON_START_WEEK;
      } else {
        key = year - 1;
        idx = SEASON_WEEKS - SEASON_START_WEEK + week;
      }
    }
    let row = byYear.get(key);
    if (!row) {
      row = new Array<number | null>(SEASON_WEEKS).fill(null);
      byYear.set(key, row);
    }
    row[idx] = p.value;
  }
  const seasons = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, values]) => ({ year, label: group === 'season' ? seasonLabel(year) : String(year), values }));
  return { group, weeks: [...(group === 'season' ? SEASON_AXIS : CALENDAR_AXIS)], seasons };
}
