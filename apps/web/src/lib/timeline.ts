/**
 * Linha do tempo da sala de situação: semanas ISO contínuas (2009-W01 → última semana da base) e
 * alinhamento de séries com cobertura diferente ao mesmo eixo (nulo onde não há dado).
 * Puro (sem React): testado em test/sala.test.ts.
 */
import { isoWeek, weekPeriodId } from '@h1n1/core';

export const TIMELINE_START = '2009-W01';
/** Replay da pandemia de 2009: da declaração de emergência (SE 17) até a declaração de fim (SE 33 de 2010). */
export const PANDEMIC_REPLAY = { from: '2009-W17', to: '2010-W33' } as const;

export function isoWeeksInYear(year: number): number {
  return isoWeek(new Date(Date.UTC(year, 11, 28))).week;
}

export function parseWeek(id: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  return { year, week };
}

/** Todas as semanas ISO de `from` a `to`, inclusive (respeita anos com 53 semanas). */
export function weekRange(from: string, to: string): string[] {
  const a = parseWeek(from);
  const b = parseWeek(to);
  if (!a || !b || from > to) return [];
  const out: string[] = [];
  for (let y = a.year; y <= b.year; y++) {
    const n = isoWeeksInYear(y);
    const start = y === a.year ? a.week : 1;
    const end = y === b.year ? Math.min(b.week, n) : n;
    for (let w = start; w <= end; w++) out.push(weekPeriodId(y, w));
  }
  return out;
}

/**
 * Alinha uma série (semanas + valores) ao eixo de semanas do scrubber: posições sem dado ficam `null`.
 * Semanas da série fora do eixo são ignoradas.
 */
export function alignWeeks<T>(axis: string[], weeks: string[], values: T[]): (T | null)[] {
  const idx = new Map<string, number>();
  axis.forEach((w, i) => idx.set(w, i));
  const out: (T | null)[] = new Array(axis.length).fill(null);
  weeks.forEach((w, i) => {
    const j = idx.get(w);
    if (j !== undefined && i < values.length) out[j] = values[i] ?? null;
  });
  return out;
}

/** Índice da semana no eixo; se ausente, índice da semana anterior mais próxima (ou 0). */
export function nearestIndex(axis: string[], week: string): number {
  const exact = axis.indexOf(week);
  if (exact >= 0) return exact;
  let best = 0;
  for (let i = 0; i < axis.length; i++) if (axis[i]! <= week) best = i;
  return best;
}

/** Cobertura de um painel dentro do eixo do scrubber: a semana selecionada está coberta? Se não, qual exibir? */
export function coverage(panelWeeks: string[], selected: string): { covered: boolean; shown: string | null; first: string | null; last: string | null } {
  if (panelWeeks.length === 0) return { covered: false, shown: null, first: null, last: null };
  const first = panelWeeks[0]!;
  const last = panelWeeks[panelWeeks.length - 1]!;
  if (panelWeeks.includes(selected)) return { covered: true, shown: selected, first, last };
  return { covered: false, shown: selected > last ? last : first, first, last };
}

/** Rótulo grande do HUD: '2026-W41' → 'SEMANA ISO 41 · 2026'. */
export function weekLabel(id: string): string {
  const p = parseWeek(id);
  return p ? `SEMANA ISO ${String(p.week).padStart(2, '0')} · ${p.year}` : id;
}

export function shortWeek(id: string): string {
  const p = parseWeek(id);
  return p ? `S${String(p.week).padStart(2, '0')}/${p.year}` : id;
}
