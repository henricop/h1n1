'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import type { GlobeResult } from '@/lib/api';
import { CHART_COLORS } from '@/lib/echarts-theme';
import { formatDateBR, formatNumberBR } from '@/lib/format';
import { hudForWeek, weekTitle } from '@/lib/hud';
import { defaultWeekIndex, shortWeek } from '@/lib/timeline';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';
import { LABEL, META, NOTE, SUMMARY, TABLE } from '@/components/charts/ui';
import { BigNumber } from './BigNumber';
import { DataCounters } from './DataCounters';
import { GlobePanel } from './GlobePanel';
import { TimelineProvider, useTimeline } from './TimelineContext';
import { TimeScrubber } from './TimeScrubber';

const EChart = dynamic(() => import('@/components/charts/EChart'), { ssr: false, loading: () => <ChartSkeleton height={320} /> });
const MAX_COMPARE = 5;
/** Cinco séries distinguíveis (≥ 3:1 sobre o papel); a legenda é textual e os botões trazem a cor numa bolinha. */
const LINE_COLORS = [CHART_COLORS.primary, CHART_COLORS.h1n1, CHART_COLORS.h3, CHART_COLORS.infb, CHART_COLORS.srag];

interface Props {
  data: GlobeResult;
  max: number;
  poster: ReactNode;
  /** Fonte do indicador (nome, órgão, link) para o número gigante. */
  source: { name: string; agency: string; href: string };
  /** <FreshnessNote/> do indicador (renderizado no servidor). */
  freshness?: ReactNode;
}

/** /dados/mundo: número gigante da semana, globo + scrubber, tabela por país da semana e comparação de até 5 países ao longo do tempo. */
export function WorldExplorer({ data, max, poster, source, freshness }: Props) {
  return (
    <TimelineProvider weeks={data.weeks} initialWeek={data.weeks[defaultWeekIndex(data.weeks, data.countries)]}>
      <WorldNumber data={data} source={source} freshness={freshness} />
      <div className="mt-14 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <GlobePanel countries={data.countries} max={max} dataAsOf={data.meta.data_as_of} universeNote={data.meta.universe_note} poster={poster} />
        </div>
        <div className="grid content-start gap-6 lg:col-span-5">
          <DataCounters countries={data.countries} dataAsOf={data.meta.data_as_of} hide={['world']} />
          <TimeScrubber compact />
        </div>
      </div>
      <Explorer data={data} />
    </TimelineProvider>
  );
}

/** Total mundial da semana selecionada em número gigante, com todos os rótulos no mesmo bloco (muda com o scrubber). */
function WorldNumber({ data, source, freshness }: { data: GlobeResult; source: Props['source']; freshness?: ReactNode }) {
  const t = useTimeline();
  const h = hudForWeek(data.countries, t.index);
  return (
    <BigNumber
      id="mundo-numero"
      kicker="( 01 ) Mundo, semana selecionada"
      indicatorName="Detecções laboratoriais de A(H1N1)pdm09 reportadas à OMS"
      definition={data.meta.case_definition}
      value={h.worldTotal}
      suppressed={false}
      threshold={5}
      unit="detections"
      unitLabel="detecções"
      period={weekTitle(t.week)}
      provisional={false}
      statusNote="As semanas mais recentes chegam incompletas e podem ser revisadas: só entram os países que reportaram na semana."
      statusLabel="semanas recentes sujeitas a revisão"
      universe={data.meta.universe_note}
      geography={`Mundo: ${h.countriesReporting} países com valor publicado na semana`}
      source={source}
      baseDate={formatDateBR(data.meta.data_as_of)}
      freshness={freshness}
      footer={<span className="text-muted">Mova a linha do tempo abaixo para trocar a semana.</span>}
    />
  );
}

function Explorer({ data }: { data: GlobeResult }) {
  const t = useTimeline();
  const h = hudForWeek(data.countries, t.index);
  const reporting = data.countries.filter((c) => c.values[t.index] !== null && c.values[t.index] !== undefined).length;
  const [selected, setSelected] = useState<string[]>(['BRA', 'USA', 'ARG']);
  const toggle = (iso3: string) => setSelected((s) => (s.includes(iso3) ? s.filter((x) => x !== iso3) : s.length >= MAX_COMPARE ? s : [...s, iso3]));
  const chosen = useMemo(() => selected.map((iso) => data.countries.find((c) => c.iso3 === iso)).filter((c): c is GlobeResult['countries'][number] => !!c), [selected, data.countries]);
  const option: EChartsOption = {
    animation: false,
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatNumberBR(typeof v === 'number' ? v : null) },
    legend: { show: false },
    grid: { left: 56, right: 16, top: 24, bottom: 64 },
    dataZoom: [{ type: 'slider', bottom: 8, height: 22, start: Math.max(0, 100 - (156 / data.weeks.length) * 100), end: 100, textStyle: { color: CHART_COLORS.faint, fontSize: 12 }, borderColor: CHART_COLORS.line }],
    xAxis: { type: 'category', data: data.weeks, axisLabel: { formatter: (v: string) => shortWeek(v) } },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => formatNumberBR(v) } },
    series: chosen.map((c, i) => ({
      name: c.name,
      type: 'line' as const,
      data: c.values,
      symbol: 'none',
      connectNulls: false,
      lineStyle: { width: 2.5, color: LINE_COLORS[i % LINE_COLORS.length], type: (['solid', 'dashed', 'dotted', 'solid', 'dashed'] as const)[i % 5] },
      itemStyle: { color: LINE_COLORS[i % LINE_COLORS.length] },
      markLine: i === 0 ? { silent: true, symbol: 'none', lineStyle: { color: CHART_COLORS.attention, type: 'dashed' as const }, data: [{ xAxis: t.week }], label: { formatter: shortWeek(t.week), color: CHART_COLORS.attention, fontSize: 12 } } : undefined,
    })),
  };
  const foot = `FluNet · OMS · base de ${formatDateBR(data.meta.data_as_of)}`;
  return (
    <div className="mt-14">
      <header className="mb-8 max-w-3xl">
        <p className="kicker-mono text-[14px]!">( 02 ) Países</p>
        <h2 className="display-md mt-3">Compare países ao longo do tempo</h2>
        <p className="mt-3 text-muted">Marque até {MAX_COMPARE} países na tabela para ver as detecções semanais lado a lado. A ordem da tabela é por detecções na semana, não por risco: cada país reporta de um jeito.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="h-tabela-paises" className="card p-5 md:p-7 lg:col-span-5">
          <p id="h-tabela-paises" className={LABEL}>
            Países · {weekTitle(t.week)} · {reporting} reportando
          </p>
          <div className="mt-4 max-h-[460px] overflow-auto scroll-thin">
            <table className={TABLE}>
              <caption className="sr-only">Detecções de A(H1N1)pdm09 por país na semana selecionada</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Comparar</span>
                  </th>
                  <th scope="col">#</th>
                  <th scope="col">País</th>
                  <th scope="col">Região OMS</th>
                  <th scope="col" className="text-right!">
                    Detecções
                  </th>
                </tr>
              </thead>
              <tbody>
                {h.ranking.map((r, i) => {
                  const c = data.countries.find((x) => x.iso3 === r.iso3)!;
                  const on = selected.includes(r.iso3);
                  return (
                    <tr key={r.iso3} className={r.iso3 === 'BRA' ? 'font-semibold text-primary-700' : undefined}>
                      <td>
                        <input type="checkbox" className="h-5 w-5 accent-primary-600" aria-label={`Comparar ${r.name}`} checked={on} disabled={!on && selected.length >= MAX_COMPARE} onChange={() => toggle(r.iso3)} />
                      </td>
                      <td className="num">{i + 1}</td>
                      <th scope="row" className="font-normal">
                        {r.name}
                      </th>
                      <td>{c.who_region ?? '—'}</td>
                      <td className="num">{formatNumberBR(r.value)}</td>
                    </tr>
                  );
                })}
                {data.countries
                  .filter((c) => c.values[t.index] === 0)
                  .map((c) => (
                    <tr key={c.iso3} className="text-faint">
                      <td>
                        <input type="checkbox" className="h-5 w-5 accent-primary-600" aria-label={`Comparar ${c.name}`} checked={selected.includes(c.iso3)} disabled={!selected.includes(c.iso3) && selected.length >= MAX_COMPARE} onChange={() => toggle(c.iso3)} />
                      </td>
                      <td className="num">—</td>
                      <th scope="row" className="font-normal">
                        {c.name}
                      </th>
                      <td>{c.who_region ?? '—'}</td>
                      <td className="num">0</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className={META}>
            {foot} · países sem valor na semana não aparecem · total da semana {formatNumberBR(h.worldTotal)}
          </p>
        </section>
        <section aria-labelledby="h-comparar" className="card p-5 md:p-7 lg:col-span-7">
          <p id="h-comparar" className={LABEL}>
            Comparação · {chosen.length} de {MAX_COMPARE} países · 2009 até hoje
          </p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Países na comparação">
            {chosen.map((c, i) => (
              <li key={c.iso3}>
                <button type="button" className="btn btn-sm" onClick={() => toggle(c.iso3)} aria-label={`Remover ${c.name} da comparação`}>
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                  {c.name} ×
                </button>
              </li>
            ))}
            {chosen.length === 0 && <li className={NOTE}>Selecione países na tabela.</li>}
          </ul>
          <div className="mt-4">
            {chosen.length > 0 && (
              <EChart option={option} height={340} ariaLabel={`Detecções semanais de A(H1N1)pdm09 em ${chosen.map((c) => c.name).join(', ')}, de ${data.weeks[0]} a ${data.weeks[data.weeks.length - 1]}; semana selecionada marcada. Tabela equivalente abaixo.`} tableId="tabela-comparacao" />
            )}
          </div>
          {chosen.length > 0 && (
            <details className="mt-4">
              <summary className={SUMMARY}>Ver como tabela (últimas 52 semanas)</summary>
              <div className="mt-3 max-h-96 overflow-auto scroll-thin">
                <table id="tabela-comparacao" className={TABLE}>
                  <caption>Detecções semanais de A(H1N1)pdm09 por país, últimas 52 semanas</caption>
                  <thead>
                    <tr>
                      <th scope="col">Semana</th>
                      {chosen.map((c) => (
                        <th key={c.iso3} scope="col" className="text-right!">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeks.slice(-52).map((w, k) => {
                      const i = data.weeks.length - 52 + k;
                      return (
                        <tr key={w}>
                          <th scope="row" className="font-normal">
                            {w}
                          </th>
                          {chosen.map((c) => (
                            <td key={c.iso3} className="num">
                              {formatNumberBR(c.values[i] ?? null)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <p className={META}>
            {foot} · {data.meta.universe_note}
          </p>
        </section>
      </div>
    </div>
  );
}
