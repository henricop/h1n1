import Link from 'next/link';
import { freshnessState, getFreshness, getSeries } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { indicatorLabel } from '@/lib/observatory';
import { isIntervalKey, lastPublished, publishedValue, sliceInterval, totalSeries, type IntervalKey } from '@/lib/series';
import { FreshnessNote } from '@/components/Notices';

interface Props {
  id: string;
  geo?: string;
  periodo?: IntervalKey | string;
}

/** Busca a série na API e mostra o último valor, período, data da base, universo e link para o observatório. */
export async function Indicador({ id, geo = 'BRA', periodo = 'ultimas-12-semanas' }: Props) {
  const geoLevel = geo === 'BRA' ? 'country' : 'state';
  const [series, fresh] = await Promise.all([getSeries({ indicator: id, geo_level: geoLevel, geo_code: geo }), getFreshness()]);
  if (!series.ok) {
    return (
      <div role="status" className="card-soft my-6 p-5 text-[15px]">
        <p className="font-semibold text-ink">Dado indisponível</p>
        <p className="text-muted">
          Não foi possível obter o indicador &ldquo;{indicatorLabel(id)}&rdquo; agora. Nenhum valor antigo é exibido como atual.
        </p>
        <Link href="/dados/brasil/">Abrir o observatório</Link>
      </div>
    );
  }
  const interval: IntervalKey = isIntervalKey(periodo) ? periodo : 'ultimas-12-semanas';
  const obs = sliceInterval(totalSeries(series.data), interval);
  const last = lastPublished(obs);
  const f = freshnessState(fresh, id);
  const unit = series.data.indicator.unit;
  return (
    <div className="card my-6 p-5">
      <p className="text-sm font-semibold text-ink">{series.data.indicator.name}</p>
      {last ? (
        <p className="mt-1">
          <span className="value">{formatNumberBR(publishedValue(last), unit)}</span>{' '}
          <span className="text-sm text-muted">
            {UNIT_LABEL[unit] ?? unit} em {formatPeriod(last.period, series.data.indicator.period_type)}
            {last.update_status === 'provisional' ? ' (provisório)' : ''} · {geo === 'BRA' ? 'Brasil' : geo}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Sem valor publicado no período selecionado.</p>
      )}
      <p className="mt-2 text-sm text-muted">
        Base de {formatDateBR(series.data.meta.data_as_of)}. <FreshnessNote state={f} />
      </p>
      <p className="mt-2 text-sm">{series.data.meta.universe_note}</p>
      <p className="mt-2 text-sm">
        <Link href={`/dados/brasil/?indicador=${encodeURIComponent(id)}`}>Ver no observatório</Link> · <Link href="/dados/metodologia/">Metodologia</Link>
      </p>
    </div>
  );
}
