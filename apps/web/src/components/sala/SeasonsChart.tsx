'use client';
import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';
import type { SeasonsResult } from '@/lib/api';
import { HUD_COLORS } from '@/lib/echarts-theme';
import { formatNumberBR } from '@/lib/format';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';

const EChart = dynamic(() => import('@/components/charts/EChart'), { ssr: false, loading: () => <ChartSkeleton height={300} /> });

const PALETTE = ['#c7d0de', '#aeb9cc', '#95a3ba', '#7c8da8', '#6478a0', '#6d5df6', '#2451d6'];

/** Sobreposição de temporadas: uma linha por ano (semanas 1..53), ano corrente em destaque rosa; anos anteriores em cinza-azulado. */
export function SeasonsChart({ seasons, unit, tableId, height = 300 }: { seasons: SeasonsResult; unit: string; tableId: string; height?: number }) {
  const years = seasons.seasons.map((s) => s.year);
  const current = Math.max(...years);
  const option: EChartsOption = {
    animation: false,
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatNumberBR(typeof v === 'number' ? v : null, unit) },
    legend: { bottom: 0, type: 'scroll' },
    grid: { left: 56, right: 16, top: 20, bottom: 56 },
    xAxis: { type: 'category', data: seasons.weeks.map(String), name: 'semana', nameLocation: 'end', nameGap: 8, axisLabel: { interval: 3 } },
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: (v: number) => formatNumberBR(v, unit) } },
    series: seasons.seasons.map((s, i) => {
      const isCurrent = s.year === current;
      return {
        name: String(s.year),
        type: 'line' as const,
        data: s.values,
        symbol: 'none',
        connectNulls: false,
        lineStyle: { width: isCurrent ? 3.5 : 1.5, color: isCurrent ? HUD_COLORS.h1n1 : PALETTE[i % PALETTE.length], opacity: isCurrent ? 1 : 0.8 },
        itemStyle: { color: isCurrent ? HUD_COLORS.h1n1 : PALETTE[i % PALETTE.length] },
        emphasis: { focus: 'series' as const },
        z: isCurrent ? 10 : 1,
      };
    }),
  };
  return (
    <div>
      <EChart option={option} height={height} ariaLabel={`${seasons.indicator.name}: sobreposição de temporadas de ${years[0]} a ${current}, por semana do ano; ${current} em destaque. Tabela equivalente abaixo.`} tableId={tableId} />
      <details className="mt-3 text-sm">
        <summary className="touch inline-flex cursor-pointer items-center text-[14px] font-medium text-primary-600">Tabela equivalente</summary>
        <div className="mt-2 max-h-80 overflow-auto scroll-thin">
          <table id={tableId} className="data-table text-xs">
            <caption>{seasons.indicator.name}, por semana do ano e temporada</caption>
            <thead>
              <tr>
                <th scope="col">Semana</th>
                {years.map((y) => (
                  <th key={y} scope="col" className="text-right">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seasons.weeks.map((w, wi) => (
                <tr key={w}>
                  <th scope="row" className="font-normal">{w}</th>
                  {seasons.seasons.map((s) => (
                    <td key={s.year} className="num">{formatNumberBR(s.values[wi] ?? null, unit)}</td>
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
