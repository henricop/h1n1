import { INDICATOR_BY_ID } from '@h1n1/core';
import { freshnessState, type ApiResult, type FreshnessRow, type LatestResult } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { FreshnessNote } from '@/components/Notices';

const MIN_VALUE_FOR_TREND = 20;

/** Último valor nacional publicado. Célula suprimida: "<5" e nenhuma tendência (achado g). */
export function LatestChip({ latest, fresh }: { latest: ApiResult<LatestResult>; fresh: ApiResult<{ data: FreshnessRow[] }> }) {
  if (!latest.ok) return <p className="text-[14px] text-muted">Último valor indisponível no momento.</p>;
  const d = latest.data;
  const unit = INDICATOR_BY_ID.get(d.indicator.id)?.unit ?? 'notifications';
  // variação escondida quando o valor é suprimido ou pequeno (percentuais sobre contagens baixas enganam)
  const showTrend = !d.suppressed && d.trend_pct_vs_4w !== null && d.value !== null && d.value >= MIN_VALUE_FOR_TREND;
  return (
    <p className="card inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-[14px] text-muted">
      <span className="font-mono text-faint">Brasil · último valor</span>
      <span className="font-display text-[1.75rem] leading-none tabular-nums tracking-[-0.01em] text-ink">{d.suppressed ? '<5' : formatNumberBR(d.value, unit)}</span>
      <span>
        {UNIT_LABEL[unit] ?? unit} em {formatPeriod(d.period)}
      </span>
      {d.provisional && <span className="font-medium text-attention-700">provisório</span>}
      {showTrend && (
        <span title="variação em relação à média das 4 semanas anteriores">
          {d.trend_pct_vs_4w! > 0 ? '▲' : d.trend_pct_vs_4w! < 0 ? '▼' : '■'} {Math.abs(d.trend_pct_vs_4w!).toFixed(0)}% vs 4 sem
        </span>
      )}
      <span className="font-mono text-faint">base de {formatDateBR(d.data_as_of)}</span>
      <FreshnessNote state={freshnessState(fresh, d.indicator.id)} />
    </p>
  );
}
