/**
 * Semanas epidemiológicas.
 * - ISO 8601 (segunda a domingo), usada pelo FluNet (ISO_YEAR/ISO_WEEK) e UKHSA.
 * - Semana epidemiológica brasileira (domingo a sábado), usada por SIVEP/SINAN (SEM_PRI/SEM_NOT).
 * - Semana MMWR do CDC (domingo a sábado, regra dos 4 dias), usada por FluView.
 */

const DAY = 86_400_000;

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`Data inválida: ${s}`);
  return utc(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Retorna { year, week } ISO 8601 para uma data. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = d.getUTCDay() || 7; // 1..7, segunda=1
  d.setUTCDate(d.getUTCDate() + 4 - day); // quinta-feira da semana
  const year = d.getUTCFullYear();
  const yearStart = utc(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return { year, week };
}

/** Segunda-feira que inicia a semana ISO. */
export function isoWeekStart(year: number, week: number): Date {
  const jan4 = utc(year, 0, 4);
  const day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (day - 1) * DAY);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * DAY);
}

/**
 * Primeiro domingo da semana epidemiológica 1.
 * - 'br' (SIVEP/SINAN): a SE 1 é a semana (domingo a sábado) que contém 1º de janeiro quando ele cai
 *   de domingo a quinta-feira (>= 3 dias em janeiro); caso contrário, a semana seguinte.
 *   Verificado empiricamente contra SEM_PRI dos arquivos INFLUD 2021, 2022, 2025 e 2026 em 2026-10-20.
 * - 'mmwr' (CDC): exige >= 4 dias em janeiro (1º de janeiro de domingo a quarta-feira).
 */
export type EpiWeekConvention = 'br' | 'mmwr';

function epiWeek1Start(year: number, convention: EpiWeekConvention): Date {
  const jan1 = utc(year, 0, 1);
  const dow = jan1.getUTCDay(); // 0=domingo
  const maxDow = convention === 'br' ? 4 : 3;
  if (dow <= maxDow) return new Date(jan1.getTime() - dow * DAY);
  return new Date(jan1.getTime() + (7 - dow) * DAY);
}

function epiWeekFor(date: Date, convention: EpiWeekConvention): { year: number; week: number } {
  const d = utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  let year = d.getUTCFullYear();
  let start = epiWeek1Start(year + 1, convention);
  if (d.getTime() >= start.getTime()) {
    year += 1;
  } else {
    start = epiWeek1Start(year, convention);
    if (d.getTime() < start.getTime()) {
      year -= 1;
      start = epiWeek1Start(year, convention);
    }
  }
  const week = Math.floor((d.getTime() - start.getTime()) / (7 * DAY)) + 1;
  return { year, week };
}

/** Semana epidemiológica brasileira (SIVEP/SINAN). */
export function epiWeek(date: Date): { year: number; week: number } {
  return epiWeekFor(date, 'br');
}

/** Semana MMWR (CDC). */
export function mmwrWeek(date: Date): { year: number; week: number } {
  return epiWeekFor(date, 'mmwr');
}

/** Domingo que inicia a semana epidemiológica brasileira. */
export function epiWeekStart(year: number, week: number): Date {
  return new Date(epiWeek1Start(year, 'br').getTime() + (week - 1) * 7 * DAY);
}

/** Domingo que inicia a semana MMWR (CDC). */
export function mmwrWeekStart(year: number, week: number): Date {
  return new Date(epiWeek1Start(year, 'mmwr').getTime() + (week - 1) * 7 * DAY);
}

export function weekPeriodId(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseWeekPeriodId(id: string): { year: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!m) throw new Error(`Período semanal inválido: ${id}`);
  return { year: Number(m[1]), week: Number(m[2]) };
}

/** Intervalo [start, end] (datas ISO) de um período, conforme o tipo. */
export function periodBounds(
  periodType: 'epiweek' | 'isoweek' | 'month' | 'year',
  period: string,
): { start: string; end: string } {
  if (periodType === 'isoweek' || periodType === 'epiweek') {
    const { year, week } = parseWeekPeriodId(period);
    const start = periodType === 'isoweek' ? isoWeekStart(year, week) : epiWeekStart(year, week);
    return { start: toIsoDate(start), end: toIsoDate(new Date(start.getTime() + 6 * DAY)) };
  }
  if (periodType === 'month') {
    const m = /^(\d{4})-M(\d{2})$/.exec(period);
    if (!m) throw new Error(`Período mensal inválido: ${period}`);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    return { start: toIsoDate(utc(y, mo - 1, 1)), end: toIsoDate(utc(y, mo, 0)) };
  }
  const y = Number(period);
  if (!Number.isInteger(y)) throw new Error(`Período anual inválido: ${period}`);
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}
