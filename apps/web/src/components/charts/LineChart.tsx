import type { SeriesObservation } from '@/lib/api';
import { formatNumberBR, formatPeriod, shortPeriod } from '@/lib/format';
import { publishedValue } from '@/lib/series';

interface Props {
  obs: SeriesObservation[];
  title: string;
  unit: string;
  tableId: string;
}

/**
 * Gráfico de linhas em SVG puro: eixos, rótulos de semana, semanas provisórias em tracejado, legenda.
 * Equivalente acessível: tabela referenciada por aria-describedby.
 */
export function LineChart({ obs, title, unit, tableId }: Props) {
  const W = 760;
  const H = 320;
  const m = { top: 16, right: 16, bottom: 56, left: 64 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const values = obs.map(publishedValue).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const rawMax = Math.max(...values);
  const niceMax = niceCeil(rawMax);
  const x = (i: number) => m.left + (obs.length === 1 ? iw / 2 : (i * iw) / (obs.length - 1));
  const y = (v: number) => m.top + ih - (v / niceMax) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * niceMax);
  const labelEvery = Math.max(1, Math.ceil(obs.length / 12));

  const segments: Array<{ pts: string; provisional: boolean }> = [];
  let cur: string[] = [];
  let curProv = false;
  obs.forEach((o, i) => {
    const v = publishedValue(o);
    if (v === null) {
      if (cur.length > 1) segments.push({ pts: cur.join(' '), provisional: curProv });
      cur = [];
      return;
    }
    const pt = `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    const prov = o.update_status === 'provisional';
    if (cur.length && prov !== curProv) {
      cur.push(pt);
      segments.push({ pts: cur.join(' '), provisional: curProv });
      cur = [pt];
    } else cur.push(pt);
    curProv = prov;
  });
  if (cur.length > 1) segments.push({ pts: cur.join(' '), provisional: curProv });

  const firstProv = obs.findIndex((o) => o.update_status === 'provisional');
  const hasGaps = obs.some((o) => publishedValue(o) === null);
  const step = obs.length > 1 ? x(1) - x(0) : 0;
  const bandX = firstProv > 0 ? x(firstProv) - step / 2 : m.left;

  return (
    <figure className="card p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${title}, por semana. Semanas provisórias em linha tracejada.`}
        aria-describedby={tableId}
        className="h-auto w-full"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--color-muted)">
              {formatNumberBR(t, unit)}
            </text>
          </g>
        ))}
        {firstProv >= 0 && <rect x={bandX} y={m.top} width={W - m.right - bandX} height={ih} fill="var(--color-attention-100)" opacity={0.7} />}
        <line x1={m.left} x2={W - m.right} y1={m.top + ih} y2={m.top + ih} stroke="var(--color-muted)" strokeWidth={1} />
        {obs.map((o, i) =>
          i % labelEvery === 0 || i === obs.length - 1 ? (
            <text key={o.period} x={x(i)} y={m.top + ih + 18} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
              {shortPeriod(o.period)}
            </text>
          ) : null,
        )}
        <text x={m.left + iw / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--color-muted)">
          Semana ({formatPeriod(obs[0]!.period)} a {formatPeriod(obs[obs.length - 1]!.period)})
        </text>
        {segments.map((s, i) => (
          <polyline key={i} points={s.pts} fill="none" stroke="var(--color-primary-600)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.provisional ? '6 4' : undefined} />
        ))}
        {obs.map((o, i) => {
          const v = publishedValue(o);
          return v !== null ? (
            <circle key={o.period} cx={x(i)} cy={y(v)} r={2.5} fill={o.update_status === 'provisional' ? 'var(--color-card)' : 'var(--color-primary-600)'} stroke="var(--color-primary-600)" strokeWidth={1.5} />
          ) : null;
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--color-primary-600)" strokeWidth="2.5" />
          </svg>
          Semana consolidada
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--color-primary-600)" strokeWidth="2.5" strokeDasharray="6 4" />
          </svg>
          Semana provisória (sujeita a revisão)
        </span>
        {hasGaps && <span>Lacunas: valores suprimidos ou não publicados</span>}
      </figcaption>
    </figure>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const n = v / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * base;
}
