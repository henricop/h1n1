import type { SeriesObservation } from '@/lib/api';
import { CHART_COLORS, SERIES_COLORS } from '@/lib/echarts-theme';
import { formatPeriod } from '@/lib/format';
import { publishedValue } from '@/lib/series';

/**
 * Sparkline SVG simples: semanas consolidadas em linha cheia (cobalto), provisórias tracejadas (âmbar escuro);
 * células suprimidas ou sem valor deixam lacuna.
 */
export function Sparkline({ obs, label, width = 240, height = 56 }: { obs: SeriesObservation[]; label: string; width?: number; height?: number }) {
  const values = obs.map(publishedValue).filter((v): v is number => v !== null);
  if (values.length < 2) return <p className="text-[14px] text-muted">Série insuficiente para desenhar tendência.</p>;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const pad = 4;
  const x = (i: number) => pad + (i * (width - pad * 2)) / Math.max(1, obs.length - 1);
  const y = (v: number) => height - pad - ((v - min) * (height - pad * 2)) / Math.max(1, max - min);

  const segments: Array<{ d: string; provisional: boolean }> = [];
  let current: string[] = [];
  let currentProv = false;
  obs.forEach((o, i) => {
    const v = publishedValue(o);
    if (v === null) {
      if (current.length > 1) segments.push({ d: current.join(' '), provisional: currentProv });
      current = [];
      return;
    }
    const pt = `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    const prov = o.update_status === 'provisional';
    if (current.length && prov !== currentProv) {
      current.push(pt);
      segments.push({ d: current.join(' '), provisional: currentProv });
      current = [pt];
    } else current.push(pt);
    currentProv = prov;
  });
  if (current.length > 1) segments.push({ d: current.join(' '), provisional: currentProv });

  const first = obs[0]!;
  const last = obs[obs.length - 1]!;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={`${label}: tendência de ${formatPeriod(first.period)} a ${formatPeriod(last.period)}; valores na tabela abaixo`}
      className="max-w-[320px]"
    >
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke={CHART_COLORS.line} strokeWidth={1} />
      {segments.map((s, i) => (
        <polyline
          key={i}
          points={s.d}
          fill="none"
          stroke={s.provisional ? SERIES_COLORS.provisional : SERIES_COLORS.final}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={s.provisional ? '4 3' : undefined}
        />
      ))}
    </svg>
  );
}
