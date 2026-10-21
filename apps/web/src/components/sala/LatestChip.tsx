import { INDICATOR_BY_ID } from '@h1n1/core';
import { freshnessState, type ApiResult, type FreshnessRow, type LatestResult } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { FreshnessNote } from '@/components/Notices';

/** Último valor nacional publicado. Célula suprimida: "<5" e nenhuma tendência (achado g). */
export function LatestChip({ latest, fresh }: { latest: ApiResult<LatestResult>; fresh: ApiResult<{ data: FreshnessRow[] }> }) {
  if (!latest.ok) return <p className="text-[13px] text-faint">último valor indisponível</p>;
  const d = latest.data;
  const unit = INDICATOR_BY_ID.get(d.indicator.id)?.unit ?? 'notifications';
  return (
    <p className="card inline-flex flex-wrap items-center gap-x-2 px-4 py-2 text-[13px] text-muted">
      <span className="text-faint">última base</span>
      <span className="font-display text-base font-bold tabular-nums text-ink">{d.suppressed ? '<5' : formatNumberBR(d.value, unit)}</span>
      <span>
        {UNIT_LABEL[unit] ?? unit} em {formatPeriod(d.period)}
      </span>
      {d.provisional && <span className="text-attention-700">provisório</span>}
      {!d.suppressed && d.trend_pct_vs_4w !== null && (
        <span title="variação vs. média das 4 semanas anteriores">
          {d.trend_pct_vs_4w > 0 ? '▲' : d.trend_pct_vs_4w < 0 ? '▼' : '■'} {Math.abs(d.trend_pct_vs_4w).toFixed(0)}% vs 4 sem
        </span>
      )}
      <span className="text-faint">base de {formatDateBR(d.data_as_of)}</span>
      <FreshnessNote state={freshnessState(fresh, d.indicator.id)} />
    </p>
  );
}
