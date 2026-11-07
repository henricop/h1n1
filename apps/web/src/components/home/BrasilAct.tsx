import Link from 'next/link';
import { LineChart } from '@/components/charts/LineChart';
import { SeriesTable } from '@/components/charts/SeriesTable';
import { Glossario } from '@/components/mdx/Glossario';
import { DataUnavailable, FreshnessNote, NoDataPublished } from '@/components/Notices';
import { BrazilMap } from '@/components/sala/BrazilMap';
import { freshnessState, getBrazilMap, getFreshness, getIndicator, getLatest, getSeries, getSource, type ApiResult, type BrazilMapResult, type FreshnessRow, type IndicatorRow, type LatestResult, type SeriesObservation, type SourceRow } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { maxPublished } from '@/lib/map-scale';
import { publishedValue, totalSeries } from '@/lib/series';
import { ACT_BRASIL, DATA_DELAY_NOTE } from '@/lib/virus/copy';
import { ActKicker } from './ActKicker';
import { CountUpVisual } from './CountUpVisual';
import { actId } from './acts';

export const SIVEP_ID = 'sivep_srag_ah1n1pdm09_confirmed';
export const FLUNET_ID = 'flunet_ah1n1pdm09_detections';
/** Nome do indicador com definição (contrato §6: nunca "casos de H1N1"). */
export const SIVEP_LABEL = 'SRAG com A(H1N1)pdm09 confirmada';
export const SIVEP_DEFINITION = 'síndrome respiratória aguda grave hospitalizada em que o laboratório confirmou influenza A(H1N1)pdm09 por RT-PCR, registrada no SIVEP-Gripe';
/** Abaixo disto (valor ou base), a variação ▲/▼ não é exibida ("poucos registros"). */
export const MIN_FOR_TREND = 20;
export const TREND_WEEKS = 52;

/** Média das `n` semanas anteriores à última com valor publicado (null se faltar série). */
export function baselineMean(obs: SeriesObservation[], n = 4): number | null {
  const vals = obs.map(publishedValue);
  const last = vals.length - 1;
  if (last < n) return null;
  const prev = vals.slice(last - n, last).filter((v): v is number => v !== null);
  return prev.length === n ? prev.reduce((a, b) => a + b, 0) / n : null;
}

/** A variação só aparece com valor e base suficientes e sem supressão. */
export function trendAllowed(latest: LatestResult, baseline: number | null, min = MIN_FOR_TREND): boolean {
  return !latest.suppressed && latest.trend_pct_vs_4w !== null && latest.value !== null && latest.value >= min && baseline !== null && baseline >= min;
}

/**
 * Ato 6 · No Brasil (server): UM número gigante (SIVEP) com todos os rótulos no mesmo bloco desde o primeiro
 * quadro (indicador com definição, valor + unidade, período em semana epidemiológica, provisório/consolidado em
 * texto, universo, fonte, "base de" + frescor, geografia, links), FluNet como cartão comum, mapa por UF da última
 * semana com tabela equivalente e tendência de 52 semanas com cauda provisória. Fundo opaco: cobre o palco.
 */
export async function BrasilAct() {
  const [fresh, latest, indicator, flLatest, flIndicator, map, series] = await Promise.all([
    getFreshness(),
    getLatest(SIVEP_ID, 'BRA'),
    getIndicator(SIVEP_ID),
    getLatest(FLUNET_ID, 'BRA'),
    getIndicator(FLUNET_ID),
    getBrazilMap({ indicator: SIVEP_ID }),
    getSeries({ indicator: SIVEP_ID, geo_level: 'country', geo_code: 'BRA' }),
  ]);
  const [source, flSource] = await Promise.all([indicator.ok ? getSource(indicator.data.data.source_id) : Promise.resolve(null), flIndicator.ok ? getSource(flIndicator.data.data.source_id) : Promise.resolve(null)]);
  const obs = series.ok ? totalSeries(series.data).slice(-TREND_WEEKS) : [];
  const id = actId(ACT_BRASIL.index);
  return (
    <section id={id} data-act={ACT_BRASIL.index} data-theme="paper" aria-labelledby={`${id}-titulo`} className="relative z-10 bg-bg px-5 py-24 md:px-10 lg:pl-[12.5rem] lg:pr-16">
      <ActKicker index={ACT_BRASIL.index} kicker={ACT_BRASIL.kicker} />
      <h2 id={`${id}-titulo`} className="display-lg mt-4 max-w-[14em]">
        {ACT_BRASIL.title}
      </h2>
      <p className="mt-5 max-w-[44rem] text-[17px] leading-relaxed text-muted">{DATA_DELAY_NOTE}</p>

      <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-10">
        {/* ===== número gigante (único) ===== */}
        <div className="lg:col-span-7">
          <BigSivep latest={latest} indicator={indicator} source={source} fresh={fresh} obs={obs} />
        </div>
        {/* ===== FluNet: cartão comum ===== */}
        <div className="lg:col-span-5">
          <FluNetCard latest={flLatest} indicator={flIndicator} source={flSource} fresh={fresh} />
        </div>
      </div>

      <div className="mt-20 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <MapByUf map={map} threshold={indicator.ok ? indicator.data.data.suppression_threshold : 5} unit={indicator.ok ? indicator.data.data.unit : 'notifications'} />
        </div>
        <div className="lg:col-span-7">
          <Trend obs={obs} series={series} unit={indicator.ok ? indicator.data.data.unit : 'notifications'} />
        </div>
      </div>
    </section>
  );
}

function sourceLabel(source: ApiResult<{ data: SourceRow }> | null): string | null {
  return source?.ok ? `${source.data.data.name} (${source.data.data.agency})` : null;
}

function BigSivep({ latest, indicator, source, fresh, obs }: { latest: ApiResult<LatestResult>; indicator: ApiResult<{ data: IndicatorRow }>; source: ApiResult<{ data: SourceRow }> | null; fresh: ApiResult<{ data: FreshnessRow[] }>; obs: SeriesObservation[] }) {
  const unit = indicator.ok ? indicator.data.data.unit : 'notifications';
  const threshold = indicator.ok ? indicator.data.data.suppression_threshold : 5;
  const unitLabel = UNIT_LABEL[unit] ?? unit;
  const href = `/dados/brasil/?indicador=${encodeURIComponent(SIVEP_ID)}`;
  const src = sourceLabel(source);
  return (
    <div className="max-w-[44rem]" data-numero-gigante>
      <h3 className="text-[19px] font-semibold leading-snug text-ink">
        {SIVEP_LABEL}
        <span className="block text-[15px] font-normal leading-relaxed text-muted">{SIVEP_DEFINITION}.</span>
      </h3>
      {latest.ok ? (
        <>
          <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="bignum">{latest.data.suppressed || latest.data.value === null ? `<${threshold}` : <CountUpVisual value={latest.data.value} unit={unit} />}</span>
            <span className="font-display text-[clamp(1.5rem,1rem+1.6vw,2rem)] text-ink">{latest.data.suppressed ? `${unitLabel} (ocultado por privacidade)` : unitLabel}</span>
          </p>
          <dl className="mt-6 grid gap-x-6 gap-y-2 text-[15px] leading-relaxed text-ink sm:grid-cols-[7rem_1fr]">
            <dt className="font-mono text-[14px] text-muted">Período</dt>
            <dd>
              <Glossario termo="semana epidemiológica">semana epidemiológica</Glossario> {formatPeriod(latest.data.period).replace(/^SE\s+/, '')}, até {formatDateBR(latest.data.period_end)}
            </dd>
            <dt className="font-mono text-[14px] text-muted">Situação</dt>
            <dd>{latest.data.provisional ? <span className="text-attention-700">Valor provisório: semanas recentes ainda recebem notificações e tendem a subir em revisões.</span> : 'Valor consolidado.'}</dd>
            <dt className="font-mono text-[14px] text-muted">Universo</dt>
            <dd>{indicator.ok ? indicator.data.data.universe_note : 'Universo do indicador indisponível no momento.'}</dd>
            <dt className="font-mono text-[14px] text-muted">Geografia</dt>
            <dd>Brasil (UF de residência do paciente).</dd>
            <dt className="font-mono text-[14px] text-muted">Fonte</dt>
            <dd>
              {src ?? 'Fonte indisponível no momento'} · <Link href="/dados/fontes/">catálogo de fontes</Link>
            </dd>
            <dt className="font-mono text-[14px] text-muted">Base</dt>
            <dd>
              base de {formatDateBR(latest.data.data_as_of)} <FreshnessNote state={freshnessState(fresh, SIVEP_ID)} />
            </dd>
          </dl>
          <TrendLine latest={latest.data} obs={obs} />
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
            <Link href={href} className="font-medium">
              Ver a série completa
            </Link>
            <Link href="/dados/metodologia/" className="font-medium">
              Como este número é calculado
            </Link>
          </p>
        </>
      ) : (
        <div className="mt-6">
          <DataUnavailable attemptedAt={latest.attemptedAt} detail={latest.error} />
          <p className="mt-3 text-[15px]">
            <Link href={href} className="font-medium">
              Ver a série no observatório
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function TrendLine({ latest, obs }: { latest: LatestResult; obs: SeriesObservation[] }) {
  const baseline = baselineMean(obs);
  if (!trendAllowed(latest, baseline)) {
    return <p className="mt-3 font-mono text-[14px] text-muted">variação não calculada: poucos registros</p>;
  }
  const t = latest.trend_pct_vs_4w!;
  return (
    <p className="mt-3 text-[15px] text-muted">
      <span className="tabular-nums text-ink">
        <span aria-hidden="true">{t > 0 ? '▲' : t < 0 ? '▼' : '■'}</span> <span className="sr-only">{t > 0 ? 'alta de' : t < 0 ? 'queda de' : 'estável:'}</span> {Math.abs(t).toFixed(0)}%
      </span>{' '}
      em relação à média das quatro semanas anteriores
    </p>
  );
}

function FluNetCard({ latest, indicator, source, fresh }: { latest: ApiResult<LatestResult>; indicator: ApiResult<{ data: IndicatorRow }>; source: ApiResult<{ data: SourceRow }> | null; fresh: ApiResult<{ data: FreshnessRow[] }> }) {
  const unit = indicator.ok ? indicator.data.data.unit : 'detections';
  const periodType = indicator.ok ? indicator.data.data.period_type : 'isoweek';
  const name = latest.ok ? latest.data.indicator.name : indicator.ok ? indicator.data.data.name : 'Detecções de A(H1N1)pdm09 (FluNet)';
  const src = sourceLabel(source);
  return (
    <section aria-labelledby="flunet-h" className="card p-6">
      <h3 id="flunet-h" className="text-[17px] font-semibold leading-snug text-ink">
        {name}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">Os dois números medem coisas diferentes e não se somam.</p>
      {latest.ok ? (
        <>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="value">{latest.data.suppressed ? '<5' : formatNumberBR(latest.data.value, unit)}</span>
            <span className="text-[15px] text-muted">
              {UNIT_LABEL[unit] ?? unit} · {formatPeriod(latest.data.period, periodType)}
            </span>
            {latest.data.provisional && <span className="rounded-full border border-attention-700/40 bg-attention-100 px-2 py-0.5 text-[14px] font-medium text-attention-700">provisório</span>}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink">{indicator.ok ? indicator.data.data.universe_note : 'Universo do indicador indisponível no momento.'}</p>
          <p className="meta text-[14px]">
            {src ? `Fonte: ${src} · ` : ''}base de {formatDateBR(latest.data.data_as_of)} <FreshnessNote state={freshnessState(fresh, FLUNET_ID)} />
          </p>
        </>
      ) : (
        <div className="mt-4">
          <DataUnavailable attemptedAt={latest.attemptedAt} detail={latest.error} />
        </div>
      )}
      <p className="mt-4 text-[15px]">
        <Link href={`/dados/brasil/?indicador=${encodeURIComponent(FLUNET_ID)}`} className="font-medium">
          Ver a série no observatório
        </Link>
      </p>
    </section>
  );
}

function MapByUf({ map, threshold, unit }: { map: ApiResult<BrazilMapResult>; threshold: number; unit: string }) {
  if (!map.ok) {
    return (
      <div>
        <h3 className="text-[19px] font-semibold text-ink">Por unidade da federação</h3>
        <div className="mt-4">
          <DataUnavailable attemptedAt={map.attemptedAt} detail={map.error} />
        </div>
      </div>
    );
  }
  const d = map.data;
  const last = d.weeks.length - 1;
  if (last < 0) {
    return (
      <div>
        <h3 className="text-[19px] font-semibold text-ink">Por unidade da federação</h3>
        <div className="mt-4">
          <NoDataPublished what="o mapa por UF" />
        </div>
      </div>
    );
  }
  const week = d.weeks[last]!;
  const max = maxPublished(
    d.states.map((s) => s.values[last] ?? null),
    d.states.map((s) => s.suppressed[last] ?? false),
  );
  const provisional = d.national.provisional[last] ?? false;
  const rows = [...d.states].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return (
    <div>
      <h3 className="text-[19px] font-semibold text-ink">Por unidade da federação</h3>
      <p className="mt-1 text-[15px] text-muted">
        {SIVEP_LABEL}, {formatPeriod(week)}
        {provisional ? ' (provisório)' : ''}. Células com menos de {threshold} registros aparecem hachuradas: ocultadas por privacidade.
      </p>
      <div className="mt-4">
        <BrazilMap states={d.states} weekIndex={last} week={formatPeriod(week)} max={max} unit={unit} threshold={threshold} indicatorName={d.indicator.name} provisional={provisional} />
      </div>
      <p className="meta">
        {d.meta.universe_note} · base de {formatDateBR(d.meta.data_as_of)}
      </p>
      <details className="mt-3">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[15px] font-medium text-primary-600">Ver como tabela</summary>
        <div className="mt-2 max-h-[24rem] overflow-y-auto scroll-thin">
          <table className="data-table">
            <caption>
              {SIVEP_LABEL} por UF, {formatPeriod(week)}; ordem alfabética, sem ranking
            </caption>
            <thead>
              <tr>
                <th scope="col">UF</th>
                <th scope="col" className="text-right">
                  {UNIT_LABEL[unit] ?? unit}
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const v = s.values[last] ?? null;
                const sup = s.suppressed[last] ?? false;
                return (
                  <tr key={s.uf}>
                    <th scope="row" className="font-normal">
                      {s.name} ({s.uf})
                    </th>
                    <td className="num">{sup ? `<${threshold}` : v === null ? '—' : formatNumberBR(v, unit)}</td>
                    <td>{sup ? 'ocultado por privacidade' : v === null ? 'sem dado publicado' : provisional ? 'provisório' : 'consolidado'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Trend({ obs, series, unit }: { obs: SeriesObservation[]; series: ApiResult<unknown>; unit: string }) {
  const tableId = 'tendencia-brasil-tabela';
  if (!series.ok) {
    return (
      <div>
        <h3 className="text-[19px] font-semibold text-ink">Tendência</h3>
        <div className="mt-4">
          <DataUnavailable attemptedAt={series.attemptedAt} detail={series.error} />
        </div>
      </div>
    );
  }
  if (obs.length < 2) {
    return (
      <div>
        <h3 className="text-[19px] font-semibold text-ink">Tendência</h3>
        <div className="mt-4">
          <NoDataPublished what="a tendência nacional" />
        </div>
      </div>
    );
  }
  const first = obs[0]!;
  const last = obs[obs.length - 1]!;
  const provisionalCount = obs.filter((o) => o.update_status === 'provisional').length;
  const threshold = 5;
  return (
    <div>
      <h3 className="text-[19px] font-semibold text-ink">Tendência</h3>
      <p className="mt-1 text-[15px] text-muted">
        {SIVEP_LABEL} no Brasil, de {formatPeriod(first.period)} a {formatPeriod(last.period)} ({obs.length} semanas)
        {provisionalCount > 0 ? `; as últimas ${provisionalCount} semanas são provisórias (cauda tracejada) e tendem a subir em revisões.` : '.'}
      </p>
      <div className="mt-4">
        <LineChart obs={obs} title={`${SIVEP_LABEL} no Brasil`} unit={unit} tableId={tableId} />
      </div>
      <details className="mt-3">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[15px] font-medium text-primary-600">Ver como tabela</summary>
        <div className="mt-2 max-h-[24rem] overflow-y-auto scroll-thin">
          <SeriesTable id={tableId} caption={`${SIVEP_LABEL} no Brasil, por semana`} obs={obs} unit={unit} suppressionThreshold={threshold} compact />
        </div>
      </details>
    </div>
  );
}
