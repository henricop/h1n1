'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import type { GlobeResult } from '@/lib/api';
import { formatDateBR, formatNumberBR } from '@/lib/format';
import { hudForWeek } from '@/lib/hud';
import { shortWeek } from '@/lib/timeline';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';
import { GlobePanel } from './GlobePanel';
import { HudCounters } from './HudCounters';
import { TimelineProvider, useTimeline } from './TimelineContext';
import { TimeScrubber } from './TimeScrubber';

const EChart = dynamic(() => import('@/components/charts/EChart'), { ssr: false, loading: () => <ChartSkeleton height={320} /> });
const MAX_COMPARE = 5;
const LINE_COLORS = ['#2451d6', '#d6007f', '#6d5df6', '#0f9f93', '#f29a0a'];

/** /dados/mundo: globo + scrubber, tabela por país da semana e comparação de até 5 países ao longo do tempo. */
export function WorldExplorer({ data, max, poster }: { data: GlobeResult; max: number; poster: ReactNode }) {
  return (
    <TimelineProvider weeks={data.weeks}>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <GlobePanel countries={data.countries} max={max} dataAsOf={data.meta.data_as_of} universeNote={data.meta.universe_note} poster={poster} />
        </div>
        <div className="grid content-start gap-4 lg:col-span-5">
          <HudCounters countries={data.countries} dataAsOf={data.meta.data_as_of} />
          <TimeScrubber compact />
        </div>
      </div>
      <Explorer data={data} />
    </TimelineProvider>
  );
}

function Explorer({ data }: { data: GlobeResult }) {
  const t = useTimeline();
  const h = hudForWeek(data.countries, t.index);
  const reporting = data.countries.filter((c) => c.values[t.index] !== null && c.values[t.index] !== undefined).length;
  const [selected, setSelected] = useState<string[]>(['BRA', 'USA', 'ARG']);
  const toggle = (iso3: string) =>
    setSelected((s) => (s.includes(iso3) ? s.filter((x) => x !== iso3) : s.length >= MAX_COMPARE ? s : [...s, iso3]));
  const chosen = useMemo(() => selected.map((iso) => data.countries.find((c) => c.iso3 === iso)).filter((c): c is GlobeResult['countries'][number] => !!c), [selected, data.countries]);
  const option: EChartsOption = {
    animation: false,
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatNumberBR(typeof v === 'number' ? v : null) },
    legend: { bottom: 0 },
    grid: { left: 56, right: 16, top: 20, bottom: 72 },
    dataZoom: [{ type: 'slider', bottom: 28, height: 16, start: Math.max(0, 100 - (156 / data.weeks.length) * 100), end: 100, textStyle: { color: '#64707f' } }],
    xAxis: { type: 'category', data: data.weeks, axisLabel: { formatter: (v: string) => shortWeek(v) } },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => formatNumberBR(v) } },
    series: chosen.map((c, i) => ({ name: c.name, type: 'line' as const, data: c.values, symbol: 'none', connectNulls: false, lineStyle: { width: 2, color: LINE_COLORS[i % LINE_COLORS.length] }, itemStyle: { color: LINE_COLORS[i % LINE_COLORS.length] }, markLine: i === 0 ? { silent: true, symbol: 'none', lineStyle: { color: '#9a5b00', type: 'dashed' }, data: [{ xAxis: t.week }], label: { formatter: shortWeek(t.week), color: '#9a5b00' } } : undefined })),
  };
  const foot = `FluNet · OMS · base de ${formatDateBR(data.meta.data_as_of)}`;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-12">
      <section aria-labelledby="h-tabela-paises" className="card p-5 lg:col-span-5">
        <p id="h-tabela-paises" className="label">
          Países na semana {shortWeek(t.week)} · {reporting} reportando
        </p>
        <p className="mt-1 text-xs text-muted">Marque até {MAX_COMPARE} países para comparar no gráfico ao lado.</p>
        <div className="mt-2 max-h-[420px] overflow-auto scroll-thin">
          <table className="data-table text-xs">
            <caption className="sr-only">Detecções de A(H1N1)pdm09 por país na semana selecionada</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Comparar</span>
                </th>
                <th scope="col">#</th>
                <th scope="col">País</th>
                <th scope="col">Região OMS</th>
                <th scope="col" className="text-right">
                  Detecções
                </th>
              </tr>
            </thead>
            <tbody>
              {h.ranking.map((r, i) => {
                const c = data.countries.find((x) => x.iso3 === r.iso3)!;
                const on = selected.includes(r.iso3);
                return (
                  <tr key={r.iso3} className={r.iso3 === 'BRA' ? 'text-primary-600' : undefined}>
                    <td>
                      <input type="checkbox" aria-label={`Comparar ${r.name}`} checked={on} disabled={!on && selected.length >= MAX_COMPARE} onChange={() => toggle(r.iso3)} />
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
                      <input type="checkbox" aria-label={`Comparar ${c.name}`} checked={selected.includes(c.iso3)} disabled={!selected.includes(c.iso3) && selected.length >= MAX_COMPARE} onChange={() => toggle(c.iso3)} />
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
        <p className="meta">{foot} · países sem valor na semana não aparecem · total da semana {formatNumberBR(h.worldTotal)}</p>
      </section>
      <section aria-labelledby="h-comparar" className="card p-5 lg:col-span-7">
        <p id="h-comparar" className="label">
          Comparação · {chosen.length} de {MAX_COMPARE} países · 2009 → hoje
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {chosen.map((c, i) => (
            <button key={c.iso3} type="button" className="btn btn-sm" style={{ borderColor: LINE_COLORS[i % LINE_COLORS.length], color: LINE_COLORS[i % LINE_COLORS.length] }} onClick={() => toggle(c.iso3)} aria-label={`Remover ${c.name} da comparação`}>
              {c.name} ×
            </button>
          ))}
          {chosen.length === 0 && <p className="text-sm text-muted">Selecione países na tabela.</p>}
        </div>
        <div className="mt-3">
          {chosen.length > 0 && <EChart option={option} height={320} ariaLabel={`Detecções semanais de A(H1N1)pdm09 em ${chosen.map((c) => c.name).join(', ')}, de ${data.weeks[0]} a ${data.weeks[data.weeks.length - 1]}; semana selecionada marcada. Tabela equivalente abaixo.`} tableId="tabela-comparacao" />}
        </div>
        {chosen.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="touch inline-flex cursor-pointer items-center text-[14px] font-medium text-primary-600">Tabela equivalente (últimas 52 semanas)</summary>
            <div className="mt-2 max-h-80 overflow-auto scroll-thin">
              <table id="tabela-comparacao" className="data-table text-xs">
                <caption>Detecções semanais de A(H1N1)pdm09 por país, últimas 52 semanas</caption>
                <thead>
                  <tr>
                    <th scope="col">Semana</th>
                    {chosen.map((c) => (
                      <th key={c.iso3} scope="col" className="text-right">
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
        <p className="meta">{foot} · {data.meta.universe_note}</p>
      </section>
    </div>
  );
}
