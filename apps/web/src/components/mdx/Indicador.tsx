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

/**
 * Painel de dado (único lugar do texto corrido onde um número atual aparece): valor em Instrument Serif, período,
 * "provisório" em texto, base de DD/MM/AAAA, universo e fonte no MESMO bloco, com links para o observatório e a
 * metodologia. Busca a série na API; sem dado, mostra "Dado indisponível" e nunca um valor antigo.
 */
export async function Indicador({ id, geo = 'BRA', periodo = 'ultimas-12-semanas' }: Props) {
  const geoLevel = geo === 'BRA' ? 'country' : 'state';
  const [series, fresh] = await Promise.all([getSeries({ indicator: id, geo_level: geoLevel, geo_code: geo }), getFreshness()]);
  if (!series.ok) {
    return (
      <div role="status" className="my-10 border-l-2 border-line-strong bg-bg-soft px-5 py-4 text-[17px]">
        <p className="font-semibold text-ink">Dado indisponível</p>
        <p className="mt-1 text-muted">
          Não foi possível obter o indicador &ldquo;{indicatorLabel(id)}&rdquo; agora. Nenhum valor antigo é exibido como atual.
        </p>
        <p className="mt-2">
          <Link href="/dados/brasil/">Abrir o observatório</Link>
        </p>
      </div>
    );
  }
  const interval: IntervalKey = isIntervalKey(periodo) ? periodo : 'ultimas-12-semanas';
  const obs = sliceInterval(totalSeries(series.data), interval);
  const last = lastPublished(obs);
  const f = freshnessState(fresh, id);
  const unit = series.data.indicator.unit;
  const src = series.data.source;
  const provisional = last?.update_status === 'provisional';
  return (
    <figure className="card my-12 p-6 md:p-8">
      <figcaption className="font-mono text-[14px] font-medium leading-snug text-muted">
        <span aria-hidden="true">[ </span>
        {series.data.indicator.name}
        <span aria-hidden="true"> ]</span>
      </figcaption>
      {last ? (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="value">{formatNumberBR(publishedValue(last), unit)}</span>
          <span className="text-[17px] text-ink">
            {UNIT_LABEL[unit] ?? unit} em {formatPeriod(last.period, series.data.indicator.period_type)} · {geo === 'BRA' ? 'Brasil' : geo}
          </span>
          {provisional && <span className="font-mono text-[14px] font-medium text-attention-700">dado provisório, sujeito a revisão</span>}
        </p>
      ) : (
        <p className="mt-4 text-[17px] text-muted">Sem valor publicado no período selecionado.</p>
      )}
      <dl className="mt-6 grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-[max-content_1fr]">
        <dt className="font-mono text-[14px] text-muted">base de</dt>
        <dd>
          {formatDateBR(series.data.meta.data_as_of)} <FreshnessNote state={f} />
        </dd>
        <dt className="font-mono text-[14px] text-muted">universo</dt>
        <dd>{series.data.meta.universe_note}</dd>
        <dt className="font-mono text-[14px] text-muted">fonte</dt>
        <dd>
          <Link href={`/dados/fontes/${src.slug}/`}>{src.name}</Link>, {src.agency}
        </dd>
      </dl>
      <p className="mt-5 text-[15px]">
        <Link href={`/dados/brasil/?indicador=${encodeURIComponent(id)}`}>Ver no observatório</Link> · <Link href="/dados/metodologia/">Metodologia</Link>
      </p>
    </figure>
  );
}
