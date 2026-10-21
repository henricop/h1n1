import { periodBounds, type Observation, type PeriodType, type GeoLevel, type UpdateStatus } from '@h1n1/core';

const DAY = 86_400_000;

export function nowStamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', 'T');
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return isoDate(new Date(Date.UTC(y, m - 1, d) + days * DAY));
}

/** Aceita '2026-04-29T00:00:00.000Z', '2026-04-29' ou 'dd/mm/aaaa'. Devolve Date UTC ou null. */
export function parseFlexibleDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface ObsInput {
  indicator_id: string;
  snapshot_id: string;
  geo_level: GeoLevel;
  geo_code: string;
  period_type: PeriodType;
  period: string;
  value: number | null;
  denominator?: number | null;
  stratum?: Record<string, string>;
  update_status?: UpdateStatus;
  quality_flags?: string[];
}

/** Monta uma Observation completa com period_start/end derivados do core. */
export function makeObs(o: ObsInput): Observation {
  const { start, end } = periodBounds(o.period_type, o.period);
  return {
    indicator_id: o.indicator_id,
    snapshot_id: o.snapshot_id,
    geo_level: o.geo_level,
    geo_code: o.geo_code,
    period_type: o.period_type,
    period: o.period,
    period_start: start,
    period_end: end,
    value: o.value,
    denominator: o.denominator ?? null,
    stratum: o.stratum ?? {},
    update_status: o.update_status ?? 'final',
    quality_flags: o.quality_flags ?? [],
  };
}

/**
 * Razão percentual com denominador mínimo: value null quando denominador < min.
 * Quando a origem é inconsistente (numerador > denominador, ocorre em séries antigas do FluNet),
 * o percentual não é calculado: value null e flag 'numerator_exceeds_denominator'.
 */
export function percent(num: number | null, den: number | null, min: number): { value: number | null; denominator: number; quality_flags: string[] } | null {
  if (den === null || num === null) return null;
  if (den < min || den <= 0) return { value: null, denominator: den, quality_flags: [] };
  if (num > den) return { value: null, denominator: den, quality_flags: ['numerator_exceeds_denominator'] };
  return { value: Math.round((100 * num) / den * 1000) / 1000, denominator: den, quality_flags: [] };
}

export function parseYearRange(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(',')) {
    const m = /^(\d{4})(?:-(\d{4}))?$/.exec(part.trim());
    if (!m) throw new Error(`Intervalo de anos inválido: ${part}`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let y = a; y <= b; y++) out.push(y);
  }
  return out;
}
