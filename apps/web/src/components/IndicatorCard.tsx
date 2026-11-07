import Link from 'next/link';
import type { ApiResult, FreshnessState, SeriesResult } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { indicatorLabel } from '@/lib/observatory';
import { headObservation, publishedValue, sliceInterval, totalSeries } from '@/lib/series';
import { Sparkline } from '@/components/charts/Sparkline';
import { SeriesTable } from '@/components/charts/SeriesTable';
import { META, NOTE, SUMMARY } from '@/components/charts/ui';
import { DataUnavailable, FreshnessNote } from '@/components/Notices';

interface Props {
  id: string;
  series: ApiResult<SeriesResult>;
  freshness: FreshnessState;
  weeks: number;
  geoLabel: string;
  withSparkline?: boolean;
}

/**
 * Cartão de indicador (painel de dado): nome do indicador, último valor em serifa, período, provisório em texto,
 * universo, fonte, "base de" + frescor, tendência (SVG) e tabela acessível. Célula suprimida: "<5", nunca o valor.
 */
export function IndicatorCard({ id, series, freshness, weeks, geoLabel, withSparkline = true }: Props) {
  if (!series.ok) {
    return (
      <section aria-labelledby={`${id}-t`} className="card p-5 md:p-6">
        <h3 id={`${id}-t`} className="font-display text-[1.75rem] font-normal leading-[1.1] text-ink">
          {indicatorLabel(id)}
        </h3>
        <div className="mt-3">
          <DataUnavailable attemptedAt={series.attemptedAt} detail={series.error} />
        </div>
      </section>
    );
  }
  const r = series.data;
  const obs = sliceInterval(totalSeries(r), 'ultimas-52-semanas').slice(-weeks);
  const head = headObservation(obs);
  const unit = r.indicator.unit;
  const tableId = `${id}-tabela`;
  const threshold = r.meta.suppression_threshold || 5;
  const value = head ? publishedValue(head) : null;
  return (
    <section aria-labelledby={`${id}-t`} className="card flex flex-col p-5 md:p-6">
      <h3 id={`${id}-t`} className="font-display text-[1.75rem] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
        {r.indicator.name}
      </h3>
      <p className={`mt-2 ${NOTE}`}>{r.indicator.case_definition}</p>
      {head ? (
        <p className="mt-4">
          <span className="value">{head.suppressed ? `<${threshold}` : formatNumberBR(value, unit)}</span>{' '}
          <span className="text-[15px] text-muted">
            {head.suppressed ? `menos de ${threshold} ${UNIT_LABEL[unit] ?? unit}, ocultado por privacidade,` : (UNIT_LABEL[unit] ?? unit)} em {formatPeriod(head.period, r.indicator.period_type)}
          </span>{' '}
          <span className={`text-[15px] ${head.update_status === 'provisional' ? 'font-medium text-attention-700' : 'text-muted'}`}>({head.update_status === 'provisional' ? 'provisório' : 'consolidado'})</span>
        </p>
      ) : (
        <p className={`mt-4 ${NOTE}`}>Sem valor publicado nas últimas {weeks} semanas.</p>
      )}
      {withSparkline && obs.length > 1 && (
        <div className="mt-4">
          <Sparkline obs={obs} label={`${r.indicator.name}, últimas ${obs.length} semanas`} />
        </div>
      )}
      <p className={`mt-4 ${NOTE}`}>{r.meta.universe_note}</p>
      <p className={META}>
        {geoLabel} · fonte{' '}
        <Link href={`/dados/fontes/${r.source.slug}/`}>
          {r.source.name} ({r.source.agency})
        </Link>{' '}
        · base de {formatDateBR(r.meta.data_as_of)} <FreshnessNote state={freshness} />
      </p>
      <details className="mt-4">
        <summary className={SUMMARY}>Ver tabela das últimas {obs.length} semanas</summary>
        <div className="mt-3">
          <SeriesTable id={tableId} caption={`${r.indicator.name}, ${geoLabel}, por semana`} obs={obs} unit={unit} periodType={r.indicator.period_type} suppressionThreshold={r.meta.suppression_threshold} compact />
        </div>
      </details>
      <p className="mt-auto pt-5 text-[15px]">
        <Link href={`/dados/brasil/?indicador=${encodeURIComponent(id)}`}>Explorar no observatório</Link> · <Link href="/dados/metodologia/">Ver metodologia</Link>
      </p>
    </section>
  );
}
