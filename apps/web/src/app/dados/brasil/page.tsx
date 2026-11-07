import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BR_STATES, stateGeoCode } from '@h1n1/core';
import { freshnessState, getBrazilMap, getFreshness, getSeries, seriesCsvUrl, type ApiResult, type BrazilMapResult, type FreshnessState, type SeriesParams, type SeriesResult } from '@/lib/api';
import { OBSERVATORY_INDICATORS, resolveObservatoryQuery, type SearchParamsLike } from '@/lib/observatory';
import { formatDateBR, formatDateTimeBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { maxPublished } from '@/lib/map-scale';
import { INTERVALS, allSuppressed, headObservation, sliceInterval, totalSeries, type IntervalKey } from '@/lib/series';
import { SITE, absoluteUrl } from '@/lib/site';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { Glossario } from '@/components/mdx/Glossario';
import { DataUnavailable, FreshnessNote } from '@/components/Notices';
import { LABEL, NOTE } from '@/components/charts/ui';
import { BigNumber } from '@/components/sala/BigNumber';
import { BrazilMap } from '@/components/sala/BrazilMap';
import { PageShell } from '@/components/sala/PageShell';
import { Panel } from '@/components/sala/Panel';
import { SectionHead } from '@/components/sala/SectionHead';
import { TrendChart } from '@/components/sala/TrendChart';
import { loadUfPaths } from '@/components/sala/uf-paths.server';

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
  const [series, fresh, map, ufPaths] = await Promise.all([
    getSeries(params),
    getFreshness(),
    indicador.byState ? getBrazilMap({ indicator: indicador.id }) : Promise.resolve(null),
    indicador.byState ? loadUfPaths() : Promise.resolve(undefined),
  ]);
  const freshness = freshnessState(fresh, indicador.id);
  const geoLabel = state ? `${state.name} (${state.uf})` : 'Brasil';

  const crumbs = [
    { label: 'Início', href: '/' },
    { label: 'Dados', href: null },
    { label: 'H1N1 no Brasil', href: '/dados/brasil/' },
  ];

  return (
    <PageShell>
      <Breadcrumb items={crumbs} />
      <header className="mt-8">
        <p className="kicker-mono text-[14px]!">[ Observatório · SIVEP-Gripe e FluNet ]</p>
        <h1 className="display-lg mt-4">H1N1 no Brasil</h1>
        <p className="lead mt-6 max-w-3xl">O que os registros oficiais mostram, semana a semana.</p>
        <p className="mt-5 max-w-3xl text-muted">
          Séries semanais de fontes oficiais. Cada indicador diz exatamente o que mede; os números não representam todos os casos de H1N1 na população. Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.
        </p>
      </header>

      <form id="seletores" method="get" action="/dados/brasil/" className="mt-10 grid gap-4 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end" aria-label="Seletores do observatório">
        <div>
          <label htmlFor="indicador" className={`block ${LABEL}`}>
            Indicador
          </label>
          <select id="indicador" name="indicador" defaultValue={indicador.id} className="select-field mt-2 w-full">
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
          <label htmlFor="uf" className={`block ${LABEL}`}>
            UF
          </label>
          <select id="uf" name="uf" defaultValue={state?.uf ?? ''} className="select-field mt-2 w-full">
            <option value="">Brasil (todas)</option>
            {BR_STATES.map((s) => (
              <option key={s.uf} value={s.uf}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="intervalo" className={`block ${LABEL}`}>
            Intervalo
          </label>
          <select id="intervalo" name="intervalo" defaultValue={intervalo} className="select-field mt-2 w-full">
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
        <p role="status" className="mt-4 text-[15px] text-attention-700">
          O indicador selecionado (FluNet) só existe para o Brasil como país; o filtro de UF foi ignorado.
        </p>
      )}

      {!series.ok ? (
        <section aria-labelledby="h-serie" className="mt-14">
          <h2 id="h-serie" className="display-md">
            {indicador.label}
          </h2>
          <p className={`mt-2 ${NOTE}`}>{geoLabel}</p>
          <div className="mt-4">
            <DataUnavailable attemptedAt={series.attemptedAt} detail={series.error} />
          </div>
        </section>
      ) : (
        <ObservatoryBody series={series.data} freshness={freshness} intervalo={intervalo} geoLabel={geoLabel} params={params} map={map} ufPaths={ufPaths} selectedUf={state?.uf ?? null} indicatorId={indicador.id} />
      )}
    </PageShell>
  );
}

/** "SE 41/2026" com o termo "SE" explicado; demais formatos passam direto. */
function periodNode(period: string, periodType: string): ReactNode {
  const text = formatPeriod(period, periodType);
  if (text.startsWith('SE ')) {
    return (
      <>
        <Glossario termo="semana epidemiológica">SE</Glossario> {text.slice(3)}
      </>
    );
  }
  return text;
}

function ObservatoryBody({
  series: r,
  freshness,
  intervalo,
  geoLabel,
  params,
  map,
  ufPaths,
  selectedUf,
  indicatorId,
}: {
  series: SeriesResult;
  freshness: FreshnessState;
  intervalo: IntervalKey;
  geoLabel: string;
  params: SeriesParams;
  map: ApiResult<BrazilMapResult> | null;
  ufPaths: Awaited<ReturnType<typeof loadUfPaths>>;
  selectedUf: string | null;
  indicatorId: string;
}) {
  const full = totalSeries(r);
  const obs = sliceInterval(full, intervalo);
  const head = headObservation(obs);
  const unit = r.indicator.unit;
  const unitLabel = UNIT_LABEL[unit] ?? unit;
  const intervalLabel = INTERVALS.find((i) => i.key === intervalo)?.label ?? intervalo;
  const everythingSuppressed = allSuppressed(obs);
  const title = `${r.indicator.name}, ${geoLabel}`;
  const csv = seriesCsvUrl(params);
  const threshold = r.meta.suppression_threshold || 5;
  const mapData = map?.ok ? map.data : null;
  const mapIndex = mapData ? mapData.weeks.length - 1 : -1;
  const mapMax = mapData && mapIndex >= 0 ? Math.max(0, ...mapData.states.map((s) => maxPublished([s.values[mapIndex] ?? null], [s.suppressed[mapIndex] ?? false]))) : 0;
  const ufHref = `/dados/brasil/?indicador=${encodeURIComponent(indicatorId)}&uf={uf}&intervalo=${intervalo}#ultimo-valor`;
  const sourceHref = `/dados/fontes/${r.source.slug}/`;
  const eventBasis = EVENT_BASIS[r.indicator.event_date_basis] ?? r.indicator.event_date_basis;
  // numeração dos capítulos segue o que existe na página
  let chapter = 0;
  const next = () => String(++chapter).padStart(2, '0');

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

      <section aria-label="Último valor publicado" className="mt-16">
        {obs.length === 0 ? (
          <div className="border-t border-ink pt-8">
            <h2 className="display-md">{r.indicator.name}</h2>
            <p className="card-soft mt-5 p-5 text-[15px]">Nenhuma observação publicada para este recorte e intervalo.</p>
          </div>
        ) : everythingSuppressed ? (
          <div className="border-t border-ink pt-8">
            <h2 className="display-md">{r.indicator.name}</h2>
            <p role="status" className="card-soft mt-5 p-5 text-[15px]">
              Todas as semanas deste recorte têm contagens pequenas e foram ocultadas por privacidade (valores abaixo de {threshold}). Isso evita reidentificação de pessoas e não significa ausência de casos. Veja o total nacional ou um intervalo maior.
            </p>
          </div>
        ) : (
          head && (
            <BigNumber
              id="ultimo-valor"
              kicker={`( ${next()} ) Último valor publicado`}
              indicatorName={r.indicator.name}
              definition={r.meta.case_definition}
              value={head.suppressed ? null : head.value}
              suppressed={head.suppressed}
              threshold={threshold}
              unit={unit}
              unitLabel={unitLabel}
              period={periodNode(head.period, r.indicator.period_type)}
              periodRange={`de ${formatDateBR(head.period_start)} a ${formatDateBR(head.period_end)}`}
              provisional={head.update_status === 'provisional'}
              universe={r.meta.universe_note}
              geography={`${geoLabel} · data do evento: ${eventBasis}`}
              source={{ name: r.source.name, agency: r.source.agency, href: sourceHref }}
              baseDate={formatDateBR(r.meta.data_as_of)}
              freshness={<FreshnessNote state={freshness} />}
              footer={
                <>
                  <a href="#h-serie">Ver a série semana a semana</a>
                  <Link href="/dados/metodologia/">Metodologia e regras de integridade</Link>
                </>
              }
            />
          )
        )}
      </section>

      {obs.length > 0 && !everythingSuppressed && (
        <section aria-labelledby="h-serie" className="mt-24">
          <SectionHead id="h-serie" n={next()} kicker="Série" lead={`${geoLabel} · ${intervalLabel} · base de ${formatDateBR(r.meta.data_as_of)}`}>
            Semana a semana
          </SectionHead>
          <Panel
            id="painel-serie"
            label={`${geoLabel} · ${intervalLabel}`}
            title={r.indicator.name}
            meta={
              <>
                {r.meta.universe_note} · fonte {r.source.name} ({r.source.agency}) · licença {r.meta.license ?? 'verificar na fonte'}; cite a fonte original · base de {formatDateBR(r.meta.data_as_of)} <FreshnessNote state={freshness} /> ·{' '}
                <a href={csv} download>
                  baixar CSV
                </a>
              </>
            }
          >
            <TrendChart obs={obs} unit={unit} title={title} periodType={r.indicator.period_type} threshold={threshold} tableId="tabela-serie" />
          </Panel>
        </section>
      )}

      {map && (
        <section aria-labelledby="h-mapa" className="mt-24">
          <SectionHead id="h-mapa" n={next()} kicker="Por UF" lead="Sem ranking: o mapa mostra onde há registros publicados, não onde é pior. UFs maiores notificam mais; compare com cuidado.">
            Mapa por UF, última semana da base
          </SectionHead>
          {mapData && mapIndex >= 0 ? (
            <Panel
              id="painel-mapa"
              label={`${mapData.indicator.name} · ${formatPeriod(mapData.weeks[mapIndex] ?? '')}`}
              meta={`${mapData.meta.universe_note} · valores abaixo de ${threshold} ocultados por privacidade (regra 9) · fonte ${mapData.meta.source_id} · base de ${formatDateBR(mapData.meta.data_as_of)}`}
            >
              <BrazilMap
                states={mapData.states}
                weekIndex={mapIndex}
                week={mapData.weeks[mapIndex] ?? ''}
                max={mapMax}
                scale="week"
                unit={unit}
                threshold={threshold}
                indicatorName={mapData.indicator.name}
                provisional={mapData.national.provisional[mapIndex] ?? false}
                paths={ufPaths}
                selectedUf={selectedUf}
                ufHref={ufHref}
                ufForm={{ action: '/dados/brasil/', hidden: { indicador: indicatorId, intervalo }, selected: selectedUf }}
              />
            </Panel>
          ) : !map.ok ? (
            <DataUnavailable attemptedAt={map.attemptedAt} detail={map.error} />
          ) : (
            <p className={NOTE}>Sem semanas publicadas para o mapa.</p>
          )}
        </section>
      )}

      <section aria-labelledby="h-nao-dizem" className="mt-24">
        <SectionHead id="h-nao-dizem" n={next()} kicker="Limites">
          O que estes números não dizem
        </SectionHead>
        <ul className="list-disc space-y-2 pl-6 text-muted marker:text-ink">
          {r.meta.caveats.map((c) => (
            <li key={c} className="max-w-3xl">
              {c}
            </li>
          ))}
          <li className="max-w-3xl">Não permitem estimar o risco individual de uma pessoa nem o número de infectados em uma cidade.</li>
          <li className="max-w-3xl">SIVEP-Gripe (SRAG hospitalizada) e FluNet (detecções laboratoriais) medem coisas diferentes e não se somem.</li>
        </ul>
      </section>

      <section aria-labelledby="h-meta" className="mt-24">
        <SectionHead id="h-meta" n={next()} kicker="Método">
          Metadados e licença
        </SectionHead>
        <dl className="grid gap-x-10 gap-y-4 border-t border-line pt-6 text-[15px] sm:grid-cols-[max-content_1fr]">
          <Meta term="Fonte">
            <Link href={sourceHref}>{r.source.name}</Link> · {r.source.agency} ·{' '}
            <a href={r.source.url} rel="noopener noreferrer" target="_blank">
              site oficial
            </a>
          </Meta>
          <Meta term="Definição de caso">{r.meta.case_definition}</Meta>
          <Meta term="Base de dados (data_as_of)">{formatDateBR(r.meta.data_as_of)}</Meta>
          <Meta term="Coleta pelo H1N1 (fetched_at)">{formatDateTimeBR(r.meta.fetched_at)}</Meta>
          <Meta term="Atraso de notificação">Semanas marcadas como provisórias ainda recebem registros; valores sobem em revisões. Data do evento: {eventBasis}.</Meta>
          <Meta term="Supressão">
            {r.meta.suppression_threshold > 0 ? `Células com valor abaixo de ${r.meta.suppression_threshold} em recortes por UF ou faixa etária são exibidas como "<${r.meta.suppression_threshold}" (ocultado por privacidade).` : 'Sem supressão de célula para este indicador.'}
          </Meta>
          <Meta term="Licença">{r.meta.license ?? 'verificar na fonte'}</Meta>
          <Meta term="Versão da metodologia">{r.indicator.methodology_version}</Meta>
          {r.snapshot && (
            <Meta term="Snapshot">
              <span className="break-all">
                {r.snapshot.id} · sha256 {r.snapshot.sha256.slice(0, 16)}…
              </span>
            </Meta>
          )}
        </dl>
        <p className="mt-6 text-[15px]">
          <Link href="/dados/metodologia/">Metodologia completa e regras de integridade</Link>
        </p>
      </section>
    </>
  );
}

function Meta({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-mono text-[14px] font-medium text-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
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
