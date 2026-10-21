const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** 'YYYY-MM-DD' ou ISO datetime → 'DD/MM/AAAA' (sem depender de fuso). */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return 'não informada';
  const m = DATE_RE.exec(value);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** ISO datetime → 'DD/MM/AAAA HH:MM (UTC)'. */
/** Normaliza timestamps do Postgres ('2026-10-20 09:02:10+00' ou '…+00:00') para ISO 8601. */
export function normalizeTimestamp(value: string): string {
  let v = value.trim().replace(' ', 'T');
  v = v.replace(/([+-]\d{2})$/, '$1:00');
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(v) && /T/.test(v)) v += 'Z';
  return v;
}

export function formatDateTimeBR(value: string | null | undefined): string {
  if (!value) return 'não informada';
  const d = new Date(normalizeTimestamp(value));
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} (UTC)`;
}

export function formatNumberBR(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return '—';
  const s = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: unit === 'percent' ? 1 : 0 }).format(value);
  return unit === 'percent' ? `${s}%` : s;
}

/** '2026-W41' → 'SE 41/2026' (semana epidemiológica ou ISO). */
export function formatPeriod(period: string, periodType?: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(period);
  if (m) return `${periodType === 'isoweek' ? 'Semana ISO' : 'SE'} ${Number(m[2])}/${m[1]}`;
  const my = /^(\d{4})-M(\d{2})$/.exec(period);
  if (my) return `${my[2]}/${my[1]}`;
  return period;
}

export function shortPeriod(period: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(period);
  return m ? `S${Number(m[2])}` : period;
}

export const UNIT_LABEL: Record<string, string> = {
  detections: 'detecções',
  notifications: 'notificações',
  deaths: 'óbitos',
  specimens: 'amostras',
  percent: '%',
  persons: 'pessoas',
};
