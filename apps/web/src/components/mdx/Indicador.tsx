import Link from 'next/link';
import { getFreshness, getSeries, freshnessFor, isStale } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { isIntervalKey, lastPublished, sliceInterval, totalSeries, type IntervalKey } from '@/lib/series';
import { StaleBadge } from '@/components/Notices';

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
      <div role="status" className="my-6 rounded-md border border-line bg-paper p-4 text-sm">
        <p className="font-semibold text-navy-900">Dado indisponível</p>
        <p className="text-muted">Não foi possível obter o indicador {id} agora. Nenhum valor antigo é exibido como atual.</p>
        <Link href="/dados/brasil/">Abrir o observatório</Link>
      </div>
    );
  }
  const interval: IntervalKey = isIntervalKey(periodo) ? periodo : 'ultimas-12-semanas';
  const obs = sliceInterval(totalSeries(series.data), interval);
  const last = lastPublished(obs);
  const f = freshnessFor(fresh, id);
  const unit = series.data.indicator.unit;
  return (
    <div className="my-6 rounded-md border border-line bg-paper p-4">
      <p className="text-sm font-semibold text-navy-900">{series.data.indicator.name}</p>
      {last ? (
        <p className="mt-1">
          <span className="text-3xl font-bold tabular-nums text-navy-900">{formatNumberBR(last.value, unit)}</span>{' '}
          <span className="text-sm text-muted">
            {UNIT_LABEL[unit] ?? unit} em {formatPeriod(last.period, series.data.indicator.period_type)}
            {last.update_status === 'provisional' ? ' (provisório)' : ''} · {geo === 'BRA' ? 'Brasil' : geo}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Sem valor publicado no período selecionado.</p>
      )}
      <p className="mt-2 text-sm text-muted">
        Base de {formatDateBR(series.data.meta.data_as_of)}. {isStale(f) && <StaleBadge ageDays={f?.age_days ?? null} />}
      </p>
      <p className="mt-2 text-sm">{series.data.meta.universe_note}</p>
      <p className="mt-2 text-sm">
        <Link href={`/dados/brasil/?indicador=${encodeURIComponent(id)}`}>Ver no observatório</Link> · <Link href="/dados/metodologia/">Metodologia</Link>
      </p>
    </div>
  );
}
