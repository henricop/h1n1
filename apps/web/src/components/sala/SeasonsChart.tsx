'use client';
import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';
import type { SeasonsResult } from '@/lib/api';
import { CHART_COLORS } from '@/lib/echarts-theme';
import { formatNumberBR } from '@/lib/format';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';
import { SUMMARY, TABLE } from '@/components/charts/ui';

const EChart = dynamic(() => import('@/components/charts/EChart'), { ssr: false, loading: () => <ChartSkeleton height={300} /> });

/** Anos anteriores em cinzas quentes (≥ 3:1 sobre o papel); o ano anterior em cobalto e o corrente em rosa, mais grosso. */
const PALETTE = ['#8a8475', '#7a7466', '#6f6a5d', '#625e55', '#57534b', '#4d4a42'];

/** Sobreposição de temporadas: uma linha por ano (semanas 1..53), ano corrente em destaque rosa; anos anteriores em cinza quente. */
export function SeasonsChart({ seasons, unit, tableId, height = 300 }: { seasons: SeasonsResult; unit: string; tableId: string; height?: number }) {
  const years = seasons.seasons.map((s) => s.year);
  const current = Math.max(...years);
  const colorFor = (year: number, i: number) => (year === current ? CHART_COLORS.h1n1 : year === current - 1 ? CHART_COLORS.primary : PALETTE[i % PALETTE.length]!);
  const option: EChartsOption = {
    animation: false,
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatNumberBR(typeof v === 'number' ? v : null, unit) },
    legend: { bottom: 0, type: 'scroll', icon: 'roundRect' },
    grid: { left: 56, right: 16, top: 24, bottom: 64 },
    xAxis: { type: 'category', data: seasons.weeks.map(String), name: 'semana', nameLocation: 'end', nameGap: 8, axisLabel: { interval: 3 } },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => formatNumberBR(v, unit) } },
    series: seasons.seasons.map((s, i) => {
      const isCurrent = s.year === current;
      const color = colorFor(s.year, i);
      return {
        name: String(s.year),
        type: 'line' as const,
        data: s.values,
        symbol: 'none',
        connectNulls: false,
        lineStyle: { width: isCurrent ? 3.5 : 1.75, color, opacity: isCurrent ? 1 : 0.9 },
        itemStyle: { color },
        emphasis: { focus: 'series' as const },
        z: isCurrent ? 10 : 1,
      };
    }),
  };
  return (
    <div>
      <EChart option={option} height={height} ariaLabel={`${seasons.indicator.name}: sobreposição de temporadas de ${years[0]} a ${current}, por semana do ano; ${current} em destaque. Tabela equivalente abaixo.`} tableId={tableId} />
      <details className="mt-4">
        <summary className={SUMMARY}>Ver como tabela</summary>
        <div className="mt-3 max-h-96 overflow-auto scroll-thin">
          <table id={tableId} className={TABLE}>
            <caption>{seasons.indicator.name}, por semana do ano e temporada</caption>
            <thead>
              <tr>
                <th scope="col">Semana</th>
                {years.map((y) => (
                  <th key={y} scope="col" className="text-right!">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seasons.weeks.map((w, wi) => (
                <tr key={w}>
                  <th scope="row" className="font-normal">
                    {w}
                  </th>
                  {seasons.seasons.map((s) => (
                    <td key={s.year} className="num">
                      {formatNumberBR(s.values[wi] ?? null, unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
