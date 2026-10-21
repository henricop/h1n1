import Link from 'next/link';
import type { ApiResult, FreshnessState, SeriesResult } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { indicatorLabel } from '@/lib/observatory';
import { lastPublished, publishedValue, sliceInterval, totalSeries } from '@/lib/series';
import { Sparkline } from '@/components/charts/Sparkline';
import { SeriesTable } from '@/components/charts/SeriesTable';
import { DataUnavailable, FreshnessNote } from '@/components/Notices';

interface Props {
  id: string;
  series: ApiResult<SeriesResult>;
  freshness: FreshnessState;
  weeks: number;
  geoLabel: string;
  withSparkline?: boolean;
}

/** Cartão de indicador da homepage: nome correto, último valor, tendência (SVG) e tabela acessível. */
export function IndicatorCard({ id, series, freshness, weeks, geoLabel, withSparkline = true }: Props) {
  if (!series.ok) {
    return (
      <section aria-labelledby={`${id}-t`} className="rounded-md border border-line bg-paper p-4">
        <h3 id={`${id}-t`} className="text-base font-semibold text-ink">
          {indicatorLabel(id)}
        </h3>
        <div className="mt-2">
          <DataUnavailable attemptedAt={series.attemptedAt} detail={series.error} />
        </div>
      </section>
    );
  }
  const r = series.data;
  const obs = sliceInterval(totalSeries(r), 'ultimas-52-semanas').slice(-weeks);
  const last = lastPublished(obs);
  const unit = r.indicator.unit;
  const tableId = `${id}-tabela`;
  return (
    <section aria-labelledby={`${id}-t`} className="flex flex-col rounded-md border border-line bg-paper p-4">
      <h3 id={`${id}-t`} className="text-base font-semibold text-ink">
        {r.indicator.name}
      </h3>
      <p className="mt-1 text-xs text-muted">
        {geoLabel} · base de {formatDateBR(r.meta.data_as_of)} <FreshnessNote state={freshness} />
      </p>
      {last ? (
        <p className="mt-3">
          <span className="text-3xl font-bold tabular-nums text-ink">{formatNumberBR(publishedValue(last), unit)}</span>{' '}
          <span className="text-sm text-muted">
            {UNIT_LABEL[unit] ?? unit} em {formatPeriod(last.period, r.indicator.period_type)}
            {last.update_status === 'provisional' ? ' (provisório)' : ''}
          </span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">Sem valor publicado nas últimas {weeks} semanas.</p>
      )}
      {withSparkline && obs.length > 1 && (
        <div className="mt-3">
          <Sparkline obs={obs} label={`${r.indicator.name}, últimas ${obs.length} semanas`} />
        </div>
      )}
      <p className="mt-3 text-sm">{r.meta.universe_note}</p>
      <details className="mt-3 text-sm">
        <summary className="touch inline-flex cursor-pointer items-center text-signal">Ver tabela das últimas {obs.length} semanas</summary>
        <div className="mt-2">
          <SeriesTable id={tableId} caption={`${r.indicator.name}, ${geoLabel}, por semana`} obs={obs} unit={unit} periodType={r.indicator.period_type} suppressionThreshold={r.meta.suppression_threshold} compact />
        </div>
      </details>
      <p className="mt-auto pt-3 text-sm">
        <Link href={`/dados/brasil/?indicador=${encodeURIComponent(id)}`}>Explorar no observatório</Link> · <Link href="/dados/metodologia/">Ver metodologia</Link>
      </p>
    </section>
  );
}
