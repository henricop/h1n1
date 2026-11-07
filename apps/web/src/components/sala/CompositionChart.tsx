'use client';
import dynamic from 'next/dynamic';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import { CHART_COLORS } from '@/lib/echarts-theme';
import { formatNumberBR, formatPeriod, shortPeriod } from '@/lib/format';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';
import { SUMMARY, TABLE } from '@/components/charts/ui';

const EChart = dynamic(() => import('@/components/charts/EChart'), { ssr: false, loading: () => <ChartSkeleton height={320} /> });

export interface CompositionLayer { id: string; name: string; values: (number | null)[]; color: string }

interface Props {
  weeks: string[];
  layers: CompositionLayer[];
  positivity: (number | null)[] | null;
  provisionalFrom: number;
  tableId: string;
  height?: number;
}

/** Composição FluNet Brasil: área empilhada por (sub)tipo + positividade (linha, eixo direito). */
export function CompositionChart({ weeks, layers, positivity, provisionalFrom, tableId, height = 320 }: Props) {
  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const idx = (list[0] as { dataIndex: number }).dataIndex;
        const w = weeks[idx] ?? '';
        const lines = [`<strong>${formatPeriod(w, 'isoweek')}</strong>${provisionalFrom >= 0 && idx >= provisionalFrom ? ` · <span style="color:${CHART_COLORS.attention}">provisório</span>` : ''}`];
        for (const l of layers) lines.push(`<span style="color:${l.color}">■</span> ${l.name}: ${formatNumberBR(l.values[idx] ?? null, 'detections')}`);
        if (positivity) lines.push(`<span style="color:${CHART_COLORS.srag}">━</span> positividade: ${formatNumberBR(positivity[idx] ?? null, 'percent')}`);
        return lines.join('<br/>');
      },
    },
    legend: { bottom: 0, icon: 'roundRect' },
    grid: { left: 56, right: positivity ? 56 : 16, top: 24, bottom: 64 },
    xAxis: { type: 'category', data: weeks, axisLabel: { formatter: (v: string) => shortPeriod(v), interval: Math.max(0, Math.ceil(weeks.length / 13) - 1) } },
    yAxis: [
      { type: 'value', min: 0, name: 'detecções', nameTextStyle: { color: CHART_COLORS.faint, align: 'left' }, axisLabel: { formatter: (v: number) => formatNumberBR(v) } },
      ...(positivity ? [{ type: 'value' as const, min: 0, max: 100, name: '% positivas', nameTextStyle: { color: CHART_COLORS.faint, align: 'right' as const }, axisLabel: { formatter: '{value}%' }, splitLine: { show: false } }] : []),
    ],
    series: [
      ...layers.map((l, i): LineSeriesOption => ({
        name: l.name,
        type: 'line' as const,
        stack: 'flunet',
        data: l.values,
        areaStyle: { color: l.color, opacity: 0.4 },
        lineStyle: { width: 1.5, color: l.color },
        itemStyle: { color: l.color },
        symbol: 'none',
        emphasis: { focus: 'series' as const },
        ...(i === 0 && provisionalFrom >= 0 && provisionalFrom < weeks.length
          ? {
              markArea: {
                silent: true,
                itemStyle: { color: CHART_COLORS.srag, opacity: 0.12 },
                label: { show: true, position: 'insideTopRight' as const, formatter: 'provisória', color: CHART_COLORS.attention, fontSize: 12 },
                data: [[{ xAxis: weeks[provisionalFrom] }, { xAxis: weeks[weeks.length - 1] }] as [{ xAxis: string | undefined }, { xAxis: string | undefined }]],
              },
            }
          : {}),
      })),
      ...(positivity
        ? [{ name: 'Positividade (%)', type: 'line' as const, yAxisIndex: 1, data: positivity, lineStyle: { width: 2.5, color: CHART_COLORS.srag }, itemStyle: { color: CHART_COLORS.srag }, symbol: 'circle', symbolSize: 4 }]
        : []),
    ],
  };
  return (
    <div>
      <EChart option={option} height={height} ariaLabel="Composição das detecções de influenza no Brasil (FluNet) por tipo e subtipo, área empilhada por semana, com positividade em linha. Tabela equivalente abaixo." tableId={tableId} />
      <details className="mt-4">
        <summary className={SUMMARY}>Ver como tabela</summary>
        <div className="mt-3 max-h-96 overflow-auto scroll-thin">
          <table id={tableId} className={TABLE}>
            <caption>Detecções FluNet Brasil por semana ISO e (sub)tipo; positividade em %</caption>
            <thead>
              <tr>
                <th scope="col">Semana</th>
                {layers.map((l) => (
                  <th key={l.id} scope="col" className="text-right!">
                    {l.name}
                  </th>
                ))}
                {positivity && (
                  <th scope="col" className="text-right!">
                    Positividade
                  </th>
                )}
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={w}>
                  <th scope="row" className="font-normal">
                    {formatPeriod(w, 'isoweek')}
                  </th>
                  {layers.map((l) => (
                    <td key={l.id} className="num">
                      {formatNumberBR(l.values[i] ?? null, 'detections')}
                    </td>
                  ))}
                  {positivity && <td className="num">{formatNumberBR(positivity[i] ?? null, 'percent')}</td>}
                  <td>{provisionalFrom >= 0 && i >= provisionalFrom ? 'provisória' : 'consolidada'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
