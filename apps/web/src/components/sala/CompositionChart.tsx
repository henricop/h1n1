'use client';
import dynamic from 'next/dynamic';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import { HUD_COLORS } from '@/lib/echarts-theme';
import { formatNumberBR, formatPeriod, shortPeriod } from '@/lib/format';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';

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

export const COMPOSITION_COLORS = { h1n1: HUD_COLORS.h1n1, h3: HUD_COLORS.h3, nsub: HUD_COLORS.gray, infb: HUD_COLORS.infb } as const;

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
        const lines = [`<strong>${formatPeriod(w, 'isoweek')}</strong>${idx >= provisionalFrom ? ' · <span style="color:#ffd166">provisório</span>' : ''}`];
        for (const l of layers) lines.push(`<span style="color:${l.color}">■</span> ${l.name}: ${formatNumberBR(l.values[idx] ?? null, 'detections')}`);
        if (positivity) lines.push(`<span style="color:${HUD_COLORS.srag}">━</span> positividade: ${formatNumberBR(positivity[idx] ?? null, 'percent')}`);
        return lines.join('<br/>');
      },
    },
    legend: { bottom: 0 },
    grid: { left: 56, right: positivity ? 52 : 16, top: 20, bottom: 56 },
    xAxis: { type: 'category', data: weeks, axisLabel: { formatter: (v: string) => shortPeriod(v), interval: Math.max(0, Math.ceil(weeks.length / 13) - 1) } },
    yAxis: [
      { type: 'value', min: 0, name: 'detecções', nameTextStyle: { color: HUD_COLORS.faint, align: 'left' }, axisLabel: { formatter: (v: number) => formatNumberBR(v) } },
      ...(positivity ? [{ type: 'value' as const, min: 0, max: 100, name: '% positivas', nameTextStyle: { color: HUD_COLORS.faint, align: 'right' as const }, axisLabel: { formatter: '{value}%' }, splitLine: { show: false } }] : []),
    ],
    series: [
      ...layers.map((l, i): LineSeriesOption => ({
        name: l.name,
        type: 'line' as const,
        stack: 'flunet',
        data: l.values,
        areaStyle: { color: l.color, opacity: 0.55 },
        lineStyle: { width: 1, color: l.color },
        itemStyle: { color: l.color },
        symbol: 'none',
        emphasis: { focus: 'series' as const },
        ...(i === 0 && provisionalFrom >= 0 && provisionalFrom < weeks.length
          ? { markArea: { silent: true, itemStyle: { color: HUD_COLORS.srag, opacity: 0.08 }, data: [[{ xAxis: weeks[provisionalFrom] }, { xAxis: weeks[weeks.length - 1] }] as [{ xAxis: string | undefined }, { xAxis: string | undefined }]] } }
          : {}),
      })),
      ...(positivity
        ? [{ name: 'Positividade (%)', type: 'line' as const, yAxisIndex: 1, data: positivity, lineStyle: { width: 2, color: HUD_COLORS.srag }, itemStyle: { color: HUD_COLORS.srag }, symbol: 'circle', symbolSize: 3 }]
        : []),
    ],
  };
  return (
    <div>
      <EChart option={option} height={height} ariaLabel="Composição das detecções de influenza no Brasil (FluNet) por tipo e subtipo, área empilhada por semana, com positividade em linha. Tabela equivalente abaixo." tableId={tableId} />
      <details className="mt-3 text-sm">
        <summary className="touch inline-flex cursor-pointer items-center font-mono text-xs uppercase tracking-wider text-signal">Tabela equivalente</summary>
        <div className="mt-2 max-h-80 overflow-auto hud-scroll">
          <table id={tableId} className="data-table text-xs">
            <caption>Detecções FluNet Brasil por semana ISO e (sub)tipo; positividade em %</caption>
            <thead>
              <tr>
                <th scope="col">Semana</th>
                {layers.map((l) => (
                  <th key={l.id} scope="col" className="text-right">{l.name}</th>
                ))}
                {positivity && <th scope="col" className="text-right">Positividade</th>}
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={w}>
                  <th scope="row" className="font-normal">{formatPeriod(w, 'isoweek')}</th>
                  {layers.map((l) => (
                    <td key={l.id} className="num">{formatNumberBR(l.values[i] ?? null, 'detections')}</td>
                  ))}
                  {positivity && <td className="num">{formatNumberBR(positivity[i] ?? null, 'percent')}</td>}
                  <td>{i >= provisionalFrom ? 'provisória' : 'consolidada'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
