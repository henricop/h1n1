import Link from 'next/link';
import { freshnessState, getFreshness, getIndicator, getLatest, getSource, type ApiResult, type FreshnessRow, type IndicatorRow, type LatestResult } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { indicatorLabel } from '@/lib/observatory';
import { DataUnavailable, FreshnessNote } from '@/components/Notices';

export const BRASIL_INDICATORS = ['sivep_srag_ah1n1pdm09_confirmed', 'flunet_ah1n1pdm09_detections'] as const;

/** Capítulo "Como está o Brasil": último valor de cada indicador com período, provisório, universo e "base de". */
export async function BrasilNow() {
  const [fresh, ...rest] = await Promise.all([getFreshness(), ...BRASIL_INDICATORS.map((id) => getLatest(id, 'BRA')), ...BRASIL_INDICATORS.map((id) => getIndicator(id))]);
  const latest = rest.slice(0, BRASIL_INDICATORS.length) as ApiResult<LatestResult>[];
  const indicators = rest.slice(BRASIL_INDICATORS.length) as ApiResult<{ data: IndicatorRow }>[];
  const sources = await Promise.all(indicators.map((i) => (i.ok ? getSource(i.data.data.source_id) : Promise.resolve(null))));
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {BRASIL_INDICATORS.map((id, i) => (
        <LatestCard key={id} id={id} latest={latest[i]!} indicator={indicators[i]!} sourceName={sources[i]?.ok ? `${sources[i]!.data.data.name} (${sources[i]!.data.data.agency})` : null} fresh={fresh} />
      ))}
    </div>
  );
}

function LatestCard({ id, latest, indicator, sourceName, fresh }: { id: string; latest: ApiResult<LatestResult>; indicator: ApiResult<{ data: IndicatorRow }>; sourceName: string | null; fresh: ApiResult<{ data: FreshnessRow[] }> }) {
  const name = latest.ok ? latest.data.indicator.name : indicator.ok ? indicator.data.data.name : indicatorLabel(id);
  const unit = indicator.ok ? indicator.data.data.unit : 'notifications';
  const href = `/dados/brasil/?indicador=${encodeURIComponent(id)}`;
  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col rounded-3xl border border-line bg-card p-6 shadow-[0_8px_30px_-12px_rgba(11,18,32,.18)]">
      <h3 id={`${id}-h`} className="text-base font-semibold leading-snug text-ink">
        {name}
      </h3>
      {latest.ok ? (
        <>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display text-5xl font-extrabold tabular-nums tracking-[-0.02em] text-primary-600">{latest.data.suppressed ? '<5' : formatNumberBR(latest.data.value, unit)}</span>
            <span className="text-sm text-muted">
              {UNIT_LABEL[unit] ?? unit} em {formatPeriod(latest.data.period)}
            </span>
            {latest.data.provisional && <span className="rounded-full border border-attention-700/40 bg-attention-100 px-2 py-0.5 text-xs font-medium text-attention-700">provisório</span>}
          </p>
          {latest.data.trend_pct_vs_4w !== null && (
            <p className="mt-1 text-sm text-muted">
              <span className="tabular-nums text-ink">
                {latest.data.trend_pct_vs_4w > 0 ? '▲' : latest.data.trend_pct_vs_4w < 0 ? '▼' : '■'} {Math.abs(latest.data.trend_pct_vs_4w).toFixed(0)}%
              </span>{' '}
              em relação à média das quatro semanas anteriores
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-ink">{indicator.ok ? indicator.data.data.universe_note : 'Universo do indicador indisponível no momento.'}</p>
          <p className="mt-3 text-xs text-muted">
            {sourceName ? `Fonte: ${sourceName} · ` : ''}base de {formatDateBR(latest.data.data_as_of)} <FreshnessNote state={freshnessState(fresh, id)} />
          </p>
        </>
      ) : (
        <div className="mt-4">
          <DataUnavailable attemptedAt={latest.attemptedAt} detail={latest.error} />
        </div>
      )}
      <p className="mt-auto pt-4 text-sm">
        <Link href={href} className="font-medium">
          Ver a série completa no observatório
        </Link>
      </p>
    </section>
  );
}
