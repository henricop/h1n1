import type { Metadata } from 'next';
import Link from 'next/link';
import { BR_STATES, stateGeoCode } from '@h1n1/core';
import { freshnessFor, getFreshness, getSeries, isStale, seriesCsvUrl, type FreshnessRow, type SeriesParams, type SeriesResult } from '@/lib/api';
import { OBSERVATORY_INDICATORS } from '@/lib/observatory';
import { formatDateBR, formatDateTimeBR, formatNumberBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { INTERVALS, allSuppressed, isIntervalKey, lastPublished, sliceInterval, totalSeries, type IntervalKey } from '@/lib/series';
import { SITE, absoluteUrl } from '@/lib/site';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { DataUnavailable, StaleBadge } from '@/components/Notices';
import { LineChart } from '@/components/charts/LineChart';
import { SeriesTable } from '@/components/charts/SeriesTable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'H1N1 no Brasil: observatório de dados oficiais',
  description: 'Séries semanais de A(H1N1)pdm09, SRAG por influenza e detecções FluNet para o Brasil e por UF, com definição de caso, universo, atraso e licença.',
  alternates: { canonical: '/dados/brasil/' },
  robots: { index: true, follow: true },
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function ObservatorioPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const indicadorParam = one(sp.indicador);
  const indicador = OBSERVATORY_INDICATORS.find((i) => i.id === indicadorParam) ?? OBSERVATORY_INDICATORS[0]!;
  const ufParam = one(sp.uf).toUpperCase();
  const state = indicador.byState ? BR_STATES.find((s) => s.uf === ufParam) ?? null : null;
  const ufIgnored = !indicador.byState && ufParam !== '';
  const intervaloParam = one(sp.intervalo);
  const intervalo: IntervalKey = isIntervalKey(intervaloParam) && intervaloParam !== 'ultimas-8-semanas' ? intervaloParam : 'ultimas-12-semanas';

  const params: SeriesParams = state
    ? { indicator: indicador.id, geo_level: 'state', geo_code: stateGeoCode(state.uf) }
    : { indicator: indicador.id, geo_level: 'country', geo_code: 'BRA' };
  const [series, fresh] = await Promise.all([getSeries(params), getFreshness()]);
  const freshRow = freshnessFor(fresh, indicador.id);
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
        <h1 className="text-3xl font-bold text-navy-900">H1N1 no Brasil</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Observatório com séries semanais de fontes oficiais. Cada indicador diz exatamente o que mede; os números não representam todos os casos de H1N1 na população e chegam com atraso de notificação.
        </p>
      </header>

      <form method="get" action="/dados/brasil/" className="mt-6 grid gap-4 rounded-md border border-line bg-paper p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" aria-label="Seletores do observatório">
        <div>
          <label htmlFor="indicador" className="block text-sm font-medium text-navy-900">
            Indicador
          </label>
          <select id="indicador" name="indicador" defaultValue={indicador.id} className="touch mt-1 w-full rounded border border-line bg-paper px-3 py-2">
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
          <label htmlFor="uf" className="block text-sm font-medium text-navy-900">
            UF
          </label>
          <select id="uf" name="uf" defaultValue={state?.uf ?? ''} className="touch mt-1 w-full rounded border border-line bg-paper px-3 py-2">
            <option value="">Brasil (todas)</option>
            {BR_STATES.map((s) => (
              <option key={s.uf} value={s.uf}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="intervalo" className="block text-sm font-medium text-navy-900">
            Intervalo
          </label>
          <select id="intervalo" name="intervalo" defaultValue={intervalo} className="touch mt-1 w-full rounded border border-line bg-paper px-3 py-2">
            {INTERVALS.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="touch rounded bg-navy-900 px-5 py-2 font-medium text-white hover:bg-navy-800">
          Atualizar
        </button>
      </form>
      {ufIgnored && (
        <p role="status" className="mt-3 text-sm text-attention-700">
          O indicador selecionado (FluNet) só existe para o Brasil como país; o filtro de UF foi ignorado.
        </p>
      )}

      {!series.ok ? (
        <div className="mt-6">
          <DataUnavailable attemptedAt={series.attemptedAt} detail={series.error} />
        </div>
      ) : (
        <ObservatoryBody series={series.data} freshRow={freshRow} intervalo={intervalo} geoLabel={geoLabel} tableId={tableId} params={params} stale={isStale(freshRow)} />
      )}
    </>
  );
}

function ObservatoryBody({
  series: r,
  freshRow,
  intervalo,
  geoLabel,
  tableId,
  params,
  stale,
}: {
  series: SeriesResult;
  freshRow: FreshnessRow | null;
  intervalo: IntervalKey;
  geoLabel: string;
  tableId: string;
  params: SeriesParams;
  stale: boolean;
}) {
  const full = totalSeries(r);
  const obs = sliceInterval(full, intervalo);
  const last = lastPublished(obs);
  const unit = r.indicator.unit;
  const intervalLabel = INTERVALS.find((i) => i.key === intervalo)?.label ?? intervalo;
  const everythingSuppressed = allSuppressed(obs);
  const title = `${r.indicator.name}, ${geoLabel}`;
  const csv = seriesCsvUrl(params);

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
          <h2 id="h-serie" className="text-xl font-semibold text-navy-900">
            {r.indicator.name}
          </h2>
          {stale && <StaleBadge ageDays={freshRow?.age_days ?? null} />}
        </div>
        <p className="mt-1 text-sm text-muted">
          {geoLabel} · {intervalLabel} · base de {formatDateBR(r.meta.data_as_of)}
        </p>

        <p className="mt-4 rounded-md border-l-4 border-navy-700 bg-navy-50 p-4 font-medium text-navy-900">{r.meta.universe_note}</p>

        {obs.length === 0 ? (
          <p className="mt-4 rounded-md border border-line bg-paper p-4 text-sm">Nenhuma observação publicada para este recorte e intervalo.</p>
        ) : everythingSuppressed ? (
          <p role="status" className="mt-4 rounded-md border border-line bg-paper p-4 text-sm">
            Todas as semanas deste recorte têm contagens pequenas e foram suprimidas (valores abaixo de {r.meta.suppression_threshold || 5}). Isso evita reidentificação de pessoas e não significa ausência de casos. Veja o total nacional ou um intervalo maior.
          </p>
        ) : (
          <>
            {last && (
              <p className="mt-4">
                <span className="text-3xl font-bold tabular-nums text-navy-900">{formatNumberBR(last.value, unit)}</span>{' '}
                <span className="text-sm text-muted">
                  {UNIT_LABEL[unit] ?? unit} em {formatPeriod(last.period, r.indicator.period_type)}
                  {last.update_status === 'provisional' ? ' (provisório)' : ''}
                </span>
              </p>
            )}
            <div className="mt-4">
              <LineChart obs={obs} title={title} unit={unit} tableId={tableId} />
            </div>
            <div className="mt-4">
              <SeriesTable id={tableId} caption={`${title}, por semana (${intervalLabel.toLowerCase()})`} obs={obs} unit={unit} periodType={r.indicator.period_type} suppressionThreshold={r.meta.suppression_threshold} />
            </div>
          </>
        )}

        <p className="mt-4">
          <a href={csv} className="touch inline-flex items-center rounded-md border border-navy-700 px-4 py-2 font-medium text-navy-900 no-underline hover:bg-navy-50" download>
            Baixar CSV
          </a>
          <span className="ml-3 text-xs text-muted">Licença: {r.meta.license ?? 'verificar na fonte'}. Cite a fonte original.</span>
        </p>
      </section>

      <section aria-labelledby="h-nao-dizem" className="mt-8">
        <h2 id="h-nao-dizem" className="text-xl font-semibold text-navy-900">
          O que estes números não dizem
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-[0.95em]">
          {r.meta.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
          <li>Não permitem estimar o risco individual de uma pessoa nem o número de infectados em uma cidade.</li>
        </ul>
      </section>

      <section aria-labelledby="h-meta" className="mt-8">
        <h2 id="h-meta" className="text-xl font-semibold text-navy-900">
          Metadados
        </h2>
        <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium text-navy-900">Fonte</dt>
          <dd>
            <Link href={`/dados/fontes/${r.source.slug}/`}>{r.source.name}</Link> · {r.source.agency} ·{' '}
            <a href={r.source.url} rel="noopener noreferrer" target="_blank">
              site oficial
            </a>
          </dd>
          <dt className="font-medium text-navy-900">Definição de caso</dt>
          <dd>{r.meta.case_definition}</dd>
          <dt className="font-medium text-navy-900">Base de dados (data_as_of)</dt>
          <dd>{formatDateBR(r.meta.data_as_of)}</dd>
          <dt className="font-medium text-navy-900">Coleta pelo H1N1 (fetched_at)</dt>
          <dd>{formatDateTimeBR(r.meta.fetched_at)}</dd>
          <dt className="font-medium text-navy-900">Atraso de notificação</dt>
          <dd>
            Semanas marcadas como provisórias ainda recebem registros; valores sobem em revisões. Data do evento: {EVENT_BASIS[r.indicator.event_date_basis] ?? r.indicator.event_date_basis}.
          </dd>
          <dt className="font-medium text-navy-900">Supressão</dt>
          <dd>{r.meta.suppression_threshold > 0 ? `Células com valor abaixo de ${r.meta.suppression_threshold} em recortes por UF ou faixa etária são exibidas como "<${r.meta.suppression_threshold}".` : 'Sem supressão de célula para este indicador.'}</dd>
          <dt className="font-medium text-navy-900">Licença</dt>
          <dd>{r.meta.license ?? 'verificar na fonte'}</dd>
          <dt className="font-medium text-navy-900">Versão da metodologia</dt>
          <dd>{r.indicator.methodology_version}</dd>
          {r.snapshot && (
            <>
              <dt className="font-medium text-navy-900">Snapshot</dt>
              <dd className="break-all font-mono text-xs">
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
