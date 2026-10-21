import type { Metadata } from 'next';
import Link from 'next/link';
import { getBrazilMap, getEars, getFreshness, getGlobe, getLatest, getNowcast, getRuns, getSeasons, getSeries, seriesCsvUrl, type ApiResult, type BrazilMapResult } from '@/lib/api';
import { eligiblePages, firstEligible } from '@/lib/content';
import { formatDateBR } from '@/lib/format';
import { globalMax } from '@/lib/hud';
import { indicatorLabel } from '@/lib/observatory';
import { sliceInterval, totalSeries } from '@/lib/series';
import { SITE, absoluteUrl } from '@/lib/site';
import { GLOBE_WINDOW_WEEKS, TIMELINE_START, defaultWeekIndex } from '@/lib/timeline';
import { JsonLd } from '@/components/JsonLd';
import { DataUnavailable, FreshnessNote, NoDataPublished } from '@/components/Notices';
import { freshnessState } from '@/lib/api';
import { BrazilStrip, type MapOption } from '@/components/sala/BrazilStrip';
import { COMPOSITION_COLORS, CompositionChart, type CompositionLayer } from '@/components/sala/CompositionChart';
import { EarsTable } from '@/components/sala/EarsTable';
import { GlobeHero } from '@/components/sala/GlobeHero';
import { GlobePoster } from '@/components/sala/GlobePoster';
import { LatestChip } from '@/components/sala/LatestChip';
import { HudFooter } from '@/components/sala/HudFooter';
import { HudTopbar } from '@/components/sala/HudTopbar';
import { IngestConsole } from '@/components/sala/IngestConsole';
import { Panel } from '@/components/sala/Panel';
import { SeasonsChart } from '@/components/sala/SeasonsChart';
import { TimelineProvider } from '@/components/sala/TimelineContext';
import { TimeScrubber } from '@/components/sala/TimeScrubber';
import { TrendChart } from '@/components/sala/TrendChart';

/** ISR: igual a API_REVALIDATE_SECONDS (src/lib/api.ts); literal por exigência do Next (ver test/cache-policy.test.ts). */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Sala de dados: H1N1 em números',
  description: 'Sala de dados do H1N1: globo com detecções de A(H1N1)pdm09 por país desde 2009, mapa de UFs do Brasil, tendência, nowcast, temporadas e composição viral, com fonte e data da base em cada número.',
  alternates: { canonical: '/sala/' },
};

const GLOBE_INDICATOR = 'flunet_ah1n1pdm09_detections';
const NATIONAL = 'sivep_srag_ah1n1pdm09_confirmed';
const MAP_OPTIONS: MapOption[] = [
  { id: 'sivep_srag_ah1n1pdm09_confirmed', label: 'H1N1pdm09 confirmado (SRAG)', unit: 'notifications' },
  { id: 'sivep_srag_influenza_confirmed', label: 'SRAG por influenza', unit: 'notifications' },
  { id: 'sivep_srag_notifications', label: 'SRAG total', unit: 'notifications' },
  { id: 'sivep_srag_ah1n1pdm09_deaths', label: 'Óbitos H1N1pdm09 (SRAG)', unit: 'deaths' },
];
const COMPOSITION: Array<{ id: string; name: string; color: string }> = [
  { id: 'flunet_ah1n1pdm09_detections', name: 'A(H1N1)pdm09', color: COMPOSITION_COLORS.h1n1 },
  { id: 'flunet_ah3_detections', name: 'A(H3)', color: COMPOSITION_COLORS.h3 },
  { id: 'flunet_inf_a_not_subtyped', name: 'A não subtipada (não é H1N1)', color: COMPOSITION_COLORS.nsub },
  { id: 'flunet_inf_b_detections', name: 'Influenza B', color: COMPOSITION_COLORS.infb },
];

function SectionTitle({ id, kicker, children }: { id: string; kicker: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-2xl font-bold tracking-[-0.02em] text-ink md:text-3xl">
      <span className="kicker block">{kicker}</span>
      {children}
    </h2>
  );
}

export default async function SalaDeDados() {
  const pages = eligiblePages();
  const q = (c: string[]) => firstEligible(c, pages);
  const institutional = [
    { label: 'Política editorial', href: q(['/sobre/politica-editorial/']) },
    { label: 'Equipe e revisão', href: q(['/sobre/equipe-e-revisao/']) },
    { label: 'Correções', href: q(['/sobre/correcoes/']) },
  ].filter((x): x is { label: string; href: string } => x.href !== null);

  const [fresh, globe, ears, nowcast, seasons, runs, latest, national, ...rest] = await Promise.all([
    getFreshness(),
    getGlobe({ indicator: GLOBE_INDICATOR, from: TIMELINE_START }),
    getEars({ indicator: NATIONAL, geo_level: 'state', weeks: 12 }),
    getNowcast({ indicator: NATIONAL, geo_code: 'BRA', weeks: 8 }),
    getSeasons({ indicator: NATIONAL, geo_code: 'BRA', from_year: 2019 }),
    getRuns(30),
    getLatest(NATIONAL, 'BRA'),
    getSeries({ indicator: NATIONAL, geo_level: 'country', geo_code: 'BRA' }),
    ...MAP_OPTIONS.map((o) => getBrazilMap({ indicator: o.id })),
    ...COMPOSITION.map((c) => getSeries({ indicator: c.id, geo_level: 'country', geo_code: 'BRA' })),
    getSeries({ indicator: 'flunet_influenza_positivity', geo_level: 'country', geo_code: 'BRA' }),
  ]);
  const maps = rest.slice(0, MAP_OPTIONS.length) as ApiResult<BrazilMapResult>[];
  const comp = rest.slice(MAP_OPTIONS.length, MAP_OPTIONS.length + COMPOSITION.length) as Awaited<ReturnType<typeof getSeries>>[];
  const positivity = rest[MAP_OPTIONS.length + COMPOSITION.length] as Awaited<ReturnType<typeof getSeries>>;
  const datasets = Object.fromEntries(MAP_OPTIONS.map((o, i) => [o.id, maps[i]!]));

  // eixo do scrubber: semanas do globo (2009-W01 → última semana FluNet); sem globo, eixo das semanas do mapa
  const weeks = globe.ok ? globe.data.weeks : (maps[0]?.ok ? maps[0].data.weeks : []);
  const globeMax = globe.ok ? globalMax(globe.data.countries) : 0;
  // semana inicial: última com cobertura razoável de países (as últimas semanas ISO chegam incompletas)
  const lastIndex = globe.ok ? defaultWeekIndex(weeks, globe.data.countries) : Math.max(0, weeks.length - 1);
  // Payload do RSC (achado m): só as últimas GLOBE_WINDOW_WEEKS semanas vão ao cliente; o histórico é carregado sob demanda em /api/globe.
  const globeOffset = Math.max(0, weeks.length - GLOBE_WINDOW_WEEKS);
  const globeWindow = globe.ok ? globe.data.countries.map((c) => ({ ...c, values: c.values.slice(globeOffset) })) : [];

  // série nacional (52 semanas) para tendência + Dataset JSON-LD
  const natObs = national.ok ? sliceInterval(totalSeries(national.data), 'ultimas-52-semanas') : [];
  const natUnit = national.ok ? national.data.indicator.unit : 'notifications';
  const threshold = national.ok ? national.data.meta.suppression_threshold || 5 : 5;

  // composição FluNet Brasil (alinhada pelas semanas da primeira série disponível)
  const compBase = comp.find((c) => c.ok);
  const compWeeks = compBase?.ok ? sliceInterval(totalSeries(compBase.data), 'ultimas-52-semanas').map((o) => o.period) : [];
  const layerFor = (i: number): CompositionLayer | null => {
    const r = comp[i];
    if (!r?.ok) return null;
    const by = new Map(totalSeries(r.data).map((o) => [o.period, o.suppressed ? null : o.value]));
    return { id: COMPOSITION[i]!.id, name: COMPOSITION[i]!.name, color: COMPOSITION[i]!.color, values: compWeeks.map((w) => by.get(w) ?? null) };
  };
  const layers = COMPOSITION.map((_, i) => layerFor(i)).filter((l): l is CompositionLayer => l !== null);
  const posBy = positivity.ok ? new Map(totalSeries(positivity.data).map((o) => [o.period, o.suppressed ? null : o.value])) : null;
  const posValues = posBy ? compWeeks.map((w) => posBy.get(w) ?? null) : null;
  const compProvFrom = compBase?.ok ? sliceInterval(totalSeries(compBase.data), 'ultimas-52-semanas').findIndex((o) => o.update_status === 'provisional') : -1;
  const compMeta = compBase?.ok ? compBase.data.meta : null;
  const compFailed = comp.find((c) => !c.ok);

  const csv = seriesCsvUrl({ indicator: NATIONAL, geo_level: 'country', geo_code: 'BRA' });

  return (
    <TimelineProvider weeks={weeks} initialWeek={weeks[lastIndex]}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', '@id': `${SITE.url}/#organization`, name: SITE.name, url: SITE.url, description: SITE.description },
            { '@type': 'WebSite', '@id': `${SITE.url}/#website`, name: SITE.name, url: SITE.url, inLanguage: 'pt-BR', publisher: { '@id': `${SITE.url}/#organization` } },
            ...(national.ok
              ? [
                  {
                    '@type': 'Dataset',
                    name: `${national.data.indicator.name}, Brasil`,
                    description: `${national.data.indicator.description} ${national.data.meta.universe_note}`,
                    url: absoluteUrl(`/dados/brasil/?indicador=${NATIONAL}`),
                    creator: { '@type': 'Organization', name: national.data.source.agency, url: national.data.source.url },
                    publisher: { '@id': `${SITE.url}/#organization` },
                    isBasedOn: national.data.snapshot?.url ?? national.data.source.url,
                    license: national.data.meta.license ?? undefined,
                    dateModified: national.data.meta.data_as_of ?? undefined,
                    temporalCoverage: natObs.length ? `${natObs[0]!.period_start}/${natObs[natObs.length - 1]!.period_end}` : undefined,
                    spatialCoverage: 'Brasil',
                    variableMeasured: national.data.indicator.name,
                    measurementTechnique: national.data.meta.case_definition,
                    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: csv }],
                    inLanguage: 'pt-BR',
                  },
                ]
              : []),
          ],
        }}
      />

      <h1 className="sr-only">Sala de dados: H1N1 em números</h1>
      <HudTopbar freshness={fresh} entendaHref={q(['/o-que-e-h1n1/', '/transmissao/', '/historia/'])} />

      {/* ===== HERO: globo + contadores + scrubber ===== */}
      <section aria-labelledby="h-globo" className="mt-10 grid gap-4 lg:grid-cols-12">
        <h2 id="h-globo" className="sr-only">
          Detecções de A(H1N1)pdm09 no mundo por semana (FluNet)
        </h2>
        {globe.ok ? (
          <GlobeHero
            indicator={GLOBE_INDICATOR}
            countries={globeWindow}
            offset={globeOffset}
            axisStart={weeks[0] ?? TIMELINE_START}
            max={globeMax}
            dataAsOf={globe.data.meta.data_as_of}
            universeNote={globe.data.meta.universe_note}
            poster={<GlobePoster countries={globeWindow} weekIndex={lastIndex - globeOffset} week={weeks[lastIndex] ?? ''} max={globeMax} dataAsOf={globe.data.meta.data_as_of} indicatorName={globe.data.indicator.name} />}
          />
        ) : (
          <>
            <div className="card p-5 lg:col-span-7">
              <p className="label">Globo · {indicatorLabel(GLOBE_INDICATOR)}</p>
              <div className="mt-3">
                <DataUnavailable attemptedAt={globe.attemptedAt} detail={globe.error} />
              </div>
            </div>
            <p className="card p-5 text-[15px] text-muted lg:col-span-5">Contadores indisponíveis sem o globo.</p>
          </>
        )}
        <div className="lg:col-span-12">
          {weeks.length > 0 && <TimeScrubber />}
          <p className="mt-3 px-1 text-[14px] leading-relaxed text-muted">
            O globo mostra <strong className="text-ink">detecções laboratoriais</strong> de A(H1N1)pdm09 reportadas à OMS por semana ISO, não casos na população. Países sem valor na semana não aparecem. Licença: termos de uso da OMS (FluNet).
            {globe.ok && ` Base de ${formatDateBR(globe.data.meta.data_as_of)}.`}
          </p>
        </div>
      </section>

      {/* ===== BRASIL ===== */}
      <section aria-labelledby="h-brasil" className="mt-16">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle id="h-brasil" kicker="Brasil">
            Por UF, sincronizado com a semana selecionada
          </SectionTitle>
          <LatestChip latest={latest} fresh={fresh} />
        </div>
        <BrazilStrip options={MAP_OPTIONS} datasets={datasets} threshold={threshold} ears={<EarsTable ears={ears} threshold={threshold} />} />
      </section>

      {/* ===== TENDÊNCIA ===== */}
      <section aria-labelledby="h-tend" className="mt-16 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <SectionTitle id="h-tend" kicker="Tendência">
            Série nacional, nowcast e temporadas
          </SectionTitle>
        </div>
        <div className="lg:col-span-7">
          <Panel
            id="painel-tendencia"
            label="Série nacional · últimas 52 semanas"
            title={national.ok ? national.data.indicator.name : indicatorLabel(NATIONAL)}
            minHeight={420}
            meta={
              national.ok ? (
                <>
                  {national.data.meta.universe_note} · fonte {national.data.source.name} ({national.data.source.agency}) · licença {national.data.meta.license ?? 'verificar'} · base de {formatDateBR(national.data.meta.data_as_of)} · <FreshnessNote state={freshnessState(fresh, NATIONAL)} />{' '}
                  <a href={csv} download>
                    CSV
                  </a>{' '}
                  · <Link href={`/dados/brasil/?indicador=${NATIONAL}&intervalo=ultimas-52-semanas`}>abrir no observatório</Link>
                </>
              ) : undefined
            }
          >
            {!national.ok ? (
              <DataUnavailable attemptedAt={national.attemptedAt} detail={national.error} />
            ) : natObs.length === 0 ? (
              <NoDataPublished what="as últimas 52 semanas" />
            ) : (
              <TrendChart obs={natObs} unit={natUnit} title={`${national.data.indicator.name}, Brasil`} periodType={national.data.indicator.period_type} threshold={threshold} nowcast={nowcast} tableId="tabela-tendencia" />
            )}
          </Panel>
        </div>
        <div className="lg:col-span-5">
          <Panel
            id="painel-temporadas"
            label="Sobreposição de temporadas · semanas 1–53"
            title={seasons.ok ? `${seasons.data.indicator.name}: ${seasons.data.seasons[0]?.year}–${seasons.data.seasons[seasons.data.seasons.length - 1]?.year}` : 'Temporadas'}
            minHeight={420}
            meta={seasons.ok ? `${seasons.data.meta.universe_note} · fonte ${seasons.data.meta.source_id} · base de ${formatDateBR(seasons.data.meta.data_as_of)} · ano corrente em rosa; os demais em tons neutros` : undefined}
          >
            {seasons.ok ? <SeasonsChart seasons={seasons.data} unit={natUnit} tableId="tabela-temporadas" /> : <DataUnavailable attemptedAt={seasons.attemptedAt} detail={seasons.error} />}
          </Panel>
        </div>
      </section>

      {/* ===== COMPOSIÇÃO ===== */}
      <section aria-labelledby="h-comp" className="mt-16">
        <div className="mb-4">
          <SectionTitle id="h-comp" kicker="Composição">
            Detecções de influenza no Brasil por tipo e subtipo (FluNet)
          </SectionTitle>
        </div>
        <Panel
          id="painel-composicao"
          label="Área empilhada por tipo e subtipo · positividade em linha"
          minHeight={400}
          meta={compMeta ? `${compMeta.universe_note} A não subtipada não é H1N1 (regra 1). Positividade depende da estratégia de coleta (regra 4). Fonte FluNet · OMS/GISRS · base de ${formatDateBR(compMeta.data_as_of)}.` : undefined}
        >
          {layers.length > 0 ? (
            <CompositionChart weeks={compWeeks} layers={layers} positivity={posValues} provisionalFrom={compProvFrom} tableId="tabela-composicao" />
          ) : compFailed && !compFailed.ok ? (
            <DataUnavailable attemptedAt={compFailed.attemptedAt} detail={compFailed.error} />
          ) : (
            <NoDataPublished what="a composição das últimas 52 semanas" />
          )}
          {!positivity.ok && <p className="mt-2 text-[13px] text-muted">Positividade indisponível no momento ({indicatorLabel('flunet_influenza_positivity')}).</p>}
        </Panel>
      </section>

      {/* ===== BASTIDORES: execuções dos conectores ===== */}
      <section aria-labelledby="h-bastidores" className="mt-16">
        <div className="mb-4">
          <SectionTitle id="h-bastidores" kicker="Bastidores">
            Execuções dos conectores
          </SectionTitle>
        </div>
        <Panel id="painel-console" label="Execuções dos conectores · últimas 30" minHeight={480} meta="Cada linha é uma execução registrada de um conector, com linhas lidas e publicadas. Falhas mantêm a versão anterior claramente datada (regra 10).">
          <IngestConsole runs={runs} />
        </Panel>
      </section>

      <div className="mt-16">
        <HudFooter institutional={institutional} />
      </div>
    </TimelineProvider>
  );
}
