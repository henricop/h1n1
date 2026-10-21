import type { SeriesObservation, SeriesResult } from './api';

export type IntervalKey = 'ultimas-12-semanas' | 'ultimas-26-semanas' | 'ultimas-52-semanas' | 'ultimas-8-semanas' | 'ano';

export const INTERVALS: ReadonlyArray<{ key: IntervalKey; label: string; weeks: number | null }> = [
  { key: 'ultimas-12-semanas', label: 'Últimas 12 semanas', weeks: 12 },
  { key: 'ultimas-26-semanas', label: 'Últimas 26 semanas', weeks: 26 },
  { key: 'ultimas-52-semanas', label: 'Últimas 52 semanas', weeks: 52 },
  { key: 'ano', label: 'Ano corrente', weeks: null },
];

export function isIntervalKey(v: string | undefined): v is IntervalKey {
  return v === 'ultimas-8-semanas' || INTERVALS.some((i) => i.key === v);
}

/** Observações do total (sem estrato), ordenadas por período. */
export function totalSeries(r: SeriesResult): SeriesObservation[] {
  return r.observations
    .filter((o) => Object.keys(o.stratum).length === 0)
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}

export function sliceInterval(obs: SeriesObservation[], interval: IntervalKey): SeriesObservation[] {
  if (interval === 'ano') {
    const last = obs[obs.length - 1];
    if (!last) return [];
    const year = last.period.slice(0, 4);
    return obs.filter((o) => o.period.startsWith(year));
  }
  const n = interval === 'ultimas-8-semanas' ? 8 : (INTERVALS.find((i) => i.key === interval)?.weeks ?? 12);
  return obs.slice(-n);
}

/** Valor publicável de uma célula: null quando suprimida (nunca exibir o valor de célula suppressed) ou não publicada. */
export function publishedValue(o: SeriesObservation): number | null {
  return o.suppressed ? null : o.value;
}

/** Última observação com valor publicável (ignora células suprimidas e sem valor). */
export function lastPublished(obs: SeriesObservation[]): SeriesObservation | null {
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    if (o && publishedValue(o) !== null) return o;
  }
  return null;
}

export function allSuppressed(obs: SeriesObservation[]): boolean {
  return obs.length > 0 && obs.every((o) => o.suppressed);
}
