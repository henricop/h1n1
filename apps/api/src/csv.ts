import type { SeriesResult } from '@h1n1/db';

export const CSV_HEADER = [
  'indicator_id', 'geo_level', 'geo_code', 'period_type', 'period', 'period_start', 'period_end', 'value',
  'denominator', 'suppressed', 'update_status', 'stratum_key', 'quality_flags', 'snapshot_id', 'data_as_of',
  'source_id', 'license',
] as const;

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serializa SeriesResult em CSV; células suprimidas saem com value vazio e suppressed=true. */
export type CsvSeriesInput = Pick<SeriesResult, 'observations' | 'meta' | 'source'>;

export function seriesToCsv(r: CsvSeriesInput): string {
  const lines: string[] = [CSV_HEADER.join(',')];
  for (const o of r.observations) {
    const key = Object.keys(o.stratum).sort().map((k) => `${k}=${o.stratum[k]}`).join(';');
    lines.push(
      [
        o.indicator_id, o.geo_level, o.geo_code, o.period_type, o.period, o.period_start, o.period_end,
        o.suppressed ? null : o.value, o.denominator, o.suppressed ? 'true' : 'false', o.update_status, key,
        o.quality_flags.join('|'), o.snapshot_id, r.meta.data_as_of, r.source.id, r.meta.license,
      ].map(cell).join(','),
    );
  }
  return lines.join('\n') + '\n';
}
