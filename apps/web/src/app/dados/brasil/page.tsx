import type { Metadata } from 'next';
import Link from 'next/link';
import { BR_STATES, stateGeoCode } from '@h1n1/core';
import { freshnessState, getBrazilMap, getFreshness, getSeries, seriesCsvUrl, type ApiResult, type BrazilMapResult, type FreshnessState, type SeriesParams, type SeriesResult } from '@/lib/api';
import { OBSERVATORY_INDICATORS, resolveObservatoryQuery, type SearchParamsLike } from '@/lib/observatory';
import { formatDateBR, formatDateTimeBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { maxPublished } from '@/lib/map-scale';
import { INTERVALS, allSuppressed, lastPublished, publishedValue, sliceInterval, totalSeries, type IntervalKey } from '@/lib/series';
import { SITE, absoluteUrl } from '@/lib/site';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { DataUnavailable, FreshnessNote } from '@/components/Notices';
import { BrazilMap } from '@/components/sala/BrazilMap';
import { Panel } from '@/components/sala/Panel';
import { TrendChart } from '@/components/sala/TrendChart';

/**
 * Dinâmica por exigência dos searchParams (indicador, uf, intervalo): cada combinação é renderizada a pedido.
 * O cache de fetch da API continua com API_REVALIDATE_SECONDS (1 h) em src/lib/api.ts.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'H1N1 no Brasil: observatório de dados oficiais',
  description: 'Séries semanais de A(H1N1)pdm09, SRAG por influenza e detecções FluNet para o Brasil e por UF, com definição de caso, universo, atraso e licença.',
  alternates: { canonical: '/dados/brasil/' },
  robots: { index: true, follow: true },
};

export default async function ObservatorioPage({ searchParams }: { searchParams: Promise<SearchParamsLike> }) {
  const sp = await searchParams;
  const { indicador, state, ufIgnored, intervalo } = resolveObservatoryQuery(sp);

  const params: SeriesParams = state
    ? { indicator: indicador.id, geo_level: 'state', geo_code: stateGeoCode(state.uf) }
    : { indicator: indicador.id, geo_level: 'country', geo_code: 'BRA' };
  const [series, fresh, map] = await Promise.all([getSeries(params), getFreshness(), indicador.byState ? getBrazilMap({ indicator: indicador.id }) : Promise.resolve(null)]);
  const freshness = freshnessState(fresh, indicador.id);
  const geoLabel = state ? `${state.name} (${state.uf})` : 'Brasil';
  const tableId = 'tabela-serie';

  const crumbs = [
    { label: 'Início', href: '/' },
    { label: 'Dados', href: null },
    { label: 'H1N1 no Brasil', href: '/dados/brasil/' },
  ];

  return (
    <>
      <Breadcrumb items={crumbs} />
      <header className="mt-2">
        <p className="kicker">Observatório · SIVEP-Gripe e FluNet</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-5xl">H1N1 no Brasil</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Séries semanais de fontes oficiais. Cada indicador diz exatamente o que mede; os números não representam todos os casos de H1N1 na população e chegam com atraso de notificação.
        </p>
      </header>

      <form method="get" action="/dados/brasil/" className="card mt-8 grid gap-4 p-5 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" aria-label="Seletores do observatório">
        <div>
          <label htmlFor="indicador" className="label block">
            Indicador
          </label>
          <select id="indicador" name="indicador" defaultValue={indicador.id} className="select-field mt-1 w-full">
            <optgroup label="SIVEP-Gripe (Ministério da Saúde): SRAG hospitalizada">
              {OBSERVATORY_INDICATORS.filter((i) => i.id.startsWith('sivep_')).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="FluNet (OMS): detecções laboratoriais">
              {OBSERVATORY_INDICATORS.filter((i) => i.id.startsWith('flunet_')).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="uf" className="label block">
            UF
          </label>
          <select id="uf" name="uf" defaultValue={state?.uf ?? ''} className="select-field mt-1 w-full">
            <option value="">Brasil (todas)</option>
            {BR_STATES.map((s) => (
              <option key={s.uf} value={s.uf}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="intervalo" className="label block">
            Intervalo
          </label>
          <select id="intervalo" name="intervalo" defaultValue={intervalo} className="select-field mt-1 w-full">
            {INTERVALS.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Atualizar
        </button>
      </form>
      {ufIgnored && (
        <p role="status" className="mt-3 text-sm text-attention-700">
          O indicador selecionado (FluNet) só existe para o Brasil como país; o filtro de UF foi ignorado.
        </p>
      )}

      {!series.ok ? (
        <section aria-labelledby="h-serie" className="mt-6">
          <h2 id="h-serie" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            {indicador.label}
          </h2>
          <p className="mt-1 text-sm text-muted">{geoLabel}</p>
          <div className="mt-3">
            <DataUnavailable attemptedAt={series.attemptedAt} detail={series.error} />
          </div>
        </section>
      ) : (
        <ObservatoryBody series={series.data} freshness={freshness} intervalo={intervalo} geoLabel={geoLabel} tableId={tableId} params={params} map={map} />
      )}
    </>
  );
}

function ObservatoryBody({
  series: r,
  freshness,
  intervalo,
  geoLabel,
  tableId,
  params,
  map,
}: {
  series: SeriesResult;
  freshness: FreshnessState;
  intervalo: IntervalKey;
  geoLabel: string;
  tableId: string;
  params: SeriesParams;
  map: ApiResult<BrazilMapResult> | null;
}) {
  const full = totalSeries(r);
  const obs = sliceInterval(full, intervalo);
  const last = lastPublished(obs);
  const unit = r.indicator.unit;
  const intervalLabel = INTERVALS.find((i) => i.key === intervalo)?.label ?? intervalo;
  const everythingSuppressed = allSuppressed(obs);
  const title = `${r.indicator.name}, ${geoLabel}`;
  const csv = seriesCsvUrl(params);
  const threshold = r.meta.suppression_threshold || 5;
  const mapData = map?.ok ? map.data : null;
  const mapIndex = mapData ? mapData.weeks.length - 1 : -1;
  const mapMax = mapData ? Math.max(...mapData.states.map((s) => maxPublished(s.values, s.suppressed))) : 0;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: title,
          description: `${r.indicator.description} ${r.meta.universe_note}`,
          url: absoluteUrl(`/dados/brasil/?indicador=${r.indicator.id}${params.geo_level === 'state' ? `&uf=${params.geo_code?.slice(3)}` : ''}`),
          creator: { '@type': 'Organization', name: r.source.agency, url: r.source.url },
          publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
          isBasedOn: r.snapshot?.url ?? r.source.url,
          license: r.meta.license ?? undefined,
          dateModified: r.meta.data_as_of ?? undefined,
          temporalCoverage: obs.length ? `${obs[0]!.period_start}/${obs[obs.length - 1]!.period_end}` : undefined,
          spatialCoverage: geoLabel,
          variableMeasured: r.indicator.name,
          measurementTechnique: r.meta.case_definition,
          distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: csv }],
          inLanguage: 'pt-BR',
        }}
      />

      <section aria-labelledby="h-serie" className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="h-serie" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            {r.indicator.name}
          </h2>
          <FreshnessNote state={freshness} />
        </div>
        <p className="mt-1 text-[14px] text-muted">
          {geoLabel} · {intervalLabel} · base de {formatDateBR(r.meta.data_as_of)}
        </p>

        <p className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 p-4 text-ink">{r.meta.universe_note}</p>

        {obs.length === 0 ? (
          <p className="card-soft mt-4 p-4 text-[15px]">Nenhuma observação publicada para este recorte e intervalo.</p>
        ) : everythingSuppressed ? (
          <p role="status" className="card-soft mt-4 p-4 text-[15px]">
            Todas as semanas deste recorte têm contagens pequenas e foram suprimidas (valores abaixo de {threshold}). Isso evita reidentificação de pessoas e não significa ausência de casos. Veja o total nacional ou um intervalo maior.
          </p>
        ) : (
          <>
            {last && (
              <p className="mt-4">
                <span className="value text-primary-600">{formatNumberBR(publishedValue(last), unit)}</span>{' '}
                <span className="text-[15px] text-muted">
                  {UNIT_LABEL[unit] ?? unit} em {formatPeriod(last.period, r.indicator.period_type)}
                  {last.update_status === 'provisional' ? <span className="text-attention-700"> (provisório)</span> : ''}
                </span>
              </p>
            )}
            <div className="card mt-4 p-5">
              <TrendChart obs={obs} unit={unit} title={title} periodType={r.indicator.period_type} threshold={threshold} tableId={tableId} />
            </div>
          </>
        )}

        <p className="mt-4 flex flex-wrap items-center gap-3">
          <a href={csv} className="btn" download>
            Baixar CSV
          </a>
          <span className="text-[13px] text-muted">Licença: {r.meta.license ?? 'verificar na fonte'}. Cite a fonte original.</span>
        </p>
      </section>

      {map && (
        <section aria-labelledby="h-mapa" className="mt-12">
          <h2 id="h-mapa" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            Mapa por UF · última semana da base
          </h2>
          <div className="mt-3">
            {mapData && mapIndex >= 0 ? (
              <Panel id="painel-mapa" label={`${mapData.indicator.name} · ${formatPeriod(mapData.weeks[mapIndex] ?? '')}`} meta={`${mapData.meta.universe_note} · células <${threshold} suprimidas (regra 9) · base de ${formatDateBR(mapData.meta.data_as_of)}`}>
                <BrazilMap states={mapData.states} weekIndex={mapIndex} week={mapData.weeks[mapIndex] ?? ''} max={mapMax} unit={unit} threshold={threshold} indicatorName={mapData.indicator.name} provisional={mapData.national.provisional[mapIndex] ?? false} />
                <details className="mt-3 text-sm">
                  <summary className="touch inline-flex cursor-pointer items-center text-[14px] font-medium text-primary-600">Tabela equivalente</summary>
                  <table className="data-table mt-2 text-xs">
                    <caption>{mapData.indicator.name} por UF na semana {formatPeriod(mapData.weeks[mapIndex] ?? '')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">UF</th>
                        <th scope="col" className="text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapData.states.map((s) => (
                        <tr key={s.uf}>
                          <th scope="row" className="font-normal">{s.name}</th>
                          <td className="num">{s.suppressed[mapIndex] ? `<${threshold}` : formatNumberBR(s.values[mapIndex] ?? null, unit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </Panel>
            ) : !map.ok ? (
              <DataUnavailable attemptedAt={map.attemptedAt} detail={map.error} />
            ) : (
              <p className="text-sm text-muted">Sem semanas publicadas para o mapa.</p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="h-nao-dizem" className="mt-12">
        <h2 id="h-nao-dizem" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          O que estes números não dizem
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-[0.95em] text-muted">
          {r.meta.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
          <li>Não permitem estimar o risco individual de uma pessoa nem o número de infectados em uma cidade.</li>
        </ul>
      </section>

      <section aria-labelledby="h-meta" className="mt-12">
        <h2 id="h-meta" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          Metadados
        </h2>
        <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium text-ink">Fonte</dt>
          <dd className="text-muted">
            <Link href={`/dados/fontes/${r.source.slug}/`}>{r.source.name}</Link> · {r.source.agency} ·{' '}
            <a href={r.source.url} rel="noopener noreferrer" target="_blank">
              site oficial
            </a>
          </dd>
          <dt className="font-medium text-ink">Definição de caso</dt>
          <dd className="text-muted">{r.meta.case_definition}</dd>
          <dt className="font-medium text-ink">Base de dados (data_as_of)</dt>
          <dd className="text-muted">{formatDateBR(r.meta.data_as_of)}</dd>
          <dt className="font-medium text-ink">Coleta pelo H1N1 (fetched_at)</dt>
          <dd className="text-muted">{formatDateTimeBR(r.meta.fetched_at)}</dd>
          <dt className="font-medium text-ink">Atraso de notificação</dt>
          <dd className="text-muted">
            Semanas marcadas como provisórias ainda recebem registros; valores sobem em revisões. Data do evento: {EVENT_BASIS[r.indicator.event_date_basis] ?? r.indicator.event_date_basis}.
          </dd>
          <dt className="font-medium text-ink">Supressão</dt>
          <dd className="text-muted">{r.meta.suppression_threshold > 0 ? `Células com valor abaixo de ${r.meta.suppression_threshold} em recortes por UF ou faixa etária são exibidas como "<${r.meta.suppression_threshold}".` : 'Sem supressão de célula para este indicador.'}</dd>
          <dt className="font-medium text-ink">Licença</dt>
          <dd className="text-muted">{r.meta.license ?? 'verificar na fonte'}</dd>
          <dt className="font-medium text-ink">Versão da metodologia</dt>
          <dd className="text-muted">{r.indicator.methodology_version}</dd>
          {r.snapshot && (
            <>
              <dt className="font-medium text-ink">Snapshot</dt>
              <dd className="break-all font-mono text-xs text-muted">
                {r.snapshot.id} · sha256 {r.snapshot.sha256.slice(0, 16)}…
              </dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-sm">
          <Link href="/dados/metodologia/">Metodologia completa e regras de integridade</Link>
        </p>
      </section>
    </>
  );
}

const EVENT_BASIS: Record<string, string> = {
  symptom_onset: 'semana dos primeiros sintomas',
  notification: 'semana de notificação',
  specimen_processing: 'semana de processamento da amostra',
  specimen_collection: 'semana de coleta da amostra',
  reference_year: 'ano de referência',
};
