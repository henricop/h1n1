'use client';
import dynamic from 'next/dynamic';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import type { ApiResult, NowcastResult, SeriesObservation } from '@/lib/api';
import { HUD_COLORS } from '@/lib/echarts-theme';
import { formatNumberBR, formatPeriod, shortPeriod } from '@/lib/format';
import { publishedValue } from '@/lib/series';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';
import { SeriesTable } from '@/components/charts/SeriesTable';

const EChart = dynamic(() => import('@/components/charts/EChart'), { ssr: false, loading: () => <ChartSkeleton height={320} /> });

interface Props {
  obs: SeriesObservation[];
  unit: string;
  title: string;
  periodType?: string;
  threshold: number;
  nowcast?: ApiResult<NowcastResult> | null;
  tableId: string;
  height?: number;
}

/** Série nacional (52 semanas) com semanas provisórias tracejadas em âmbar e nowcast sobreposto (faixa + estimativa). */
export function TrendChart({ obs, unit, title, periodType, threshold, nowcast, tableId, height = 320 }: Props) {
  const periods = obs.map((o) => o.period);
  const firstProv = obs.findIndex((o) => o.update_status === 'provisional');
  const finalLine = obs.map((o, i) => (o.update_status === 'final' || i === firstProv ? publishedValue(o) : null));
  const provLine = obs.map((o, i) => (o.update_status === 'provisional' || (firstProv > 0 && i === firstProv - 1) ? publishedValue(o) : null));
  const nc = nowcast?.ok ? nowcast.data : null;
  const ncBy = new Map((nc?.results ?? []).map((r) => [r.period, r]));
  const lower = periods.map((p) => ncBy.get(p)?.lower ?? null);
  const band = periods.map((p) => {
    const r = ncBy.get(p);
    return r ? r.upper - r.lower : null;
  });
  const estimate = periods.map((p) => ncBy.get(p)?.estimated ?? null);
  const fmt = (v: number | null) => formatNumberBR(v, unit);

  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const idx = (list[0] as { dataIndex: number }).dataIndex;
        const o = obs[idx];
        if (!o) return '';
        const r = ncBy.get(o.period);
        const lines = [`<strong>${formatPeriod(o.period, periodType)}</strong>`, `${o.suppressed ? `<${threshold} (suprimido)` : fmt(publishedValue(o))} ${o.update_status === 'provisional' ? '· <span style="color:#9a5b00">provisório</span>' : '· consolidado'}`];
        if (r) lines.push(`nowcast: ${fmt(r.estimated)} (${fmt(r.lower)}–${fmt(r.upper)}) · ${(r.reported_share * 100).toFixed(0)}% já digitado`);
        return lines.join('<br/>');
      },
    },
    legend: { bottom: 0, data: ['Consolidada', 'Provisória', ...(nc ? ['Nowcast (estimativa)', 'Nowcast (faixa)'] : [])] },
    grid: { left: 56, right: 16, top: 20, bottom: 56 },
    xAxis: { type: 'category', data: periods, axisLabel: { formatter: (v: string) => shortPeriod(v), interval: Math.max(0, Math.ceil(periods.length / 13) - 1) } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumberBR(v, unit) }, min: 0 },
    series: ([
      ...(nc
        ? [
            { name: 'Nowcast (base)', type: 'line' as const, data: lower, stack: 'nc', lineStyle: { opacity: 0 }, symbol: 'none', silent: true, tooltip: { show: false } },
            { name: 'Nowcast (faixa)', type: 'line' as const, data: band, stack: 'nc', lineStyle: { opacity: 0 }, areaStyle: { color: HUD_COLORS.h1n1, opacity: 0.16 }, symbol: 'none', silent: true, tooltip: { show: false } },
            { name: 'Nowcast (estimativa)', type: 'line' as const, data: estimate, lineStyle: { type: 'dotted' as const, width: 2, color: HUD_COLORS.h1n1 }, itemStyle: { color: HUD_COLORS.h1n1 }, symbol: 'diamond', symbolSize: 7, connectNulls: true },
          ]
        : []),
      {
        name: 'Consolidada',
        type: 'line',
        data: finalLine,
        lineStyle: { width: 2.5, color: HUD_COLORS.signal },
        itemStyle: { color: HUD_COLORS.signal },
        symbolSize: 4,
        ...(firstProv >= 0
          ? { markArea: { silent: true, itemStyle: { color: HUD_COLORS.srag, opacity: 0.12 }, data: [[{ xAxis: periods[Math.max(0, firstProv)] }, { xAxis: periods[periods.length - 1] }] as [{ xAxis: string | undefined }, { xAxis: string | undefined }]] } }
          : {}),
      },
      { name: 'Provisória', type: 'line', data: provLine, lineStyle: { width: 2.5, type: 'dashed' as const, color: HUD_COLORS.srag }, itemStyle: { color: HUD_COLORS.srag }, symbolSize: 5 },
    ] as LineSeriesOption[]),
  };

  return (
    <div>
      <EChart option={option} height={height} ariaLabel={`${title}, por semana; semanas provisórias tracejadas em âmbar; nowcast como faixa e estimativa pontilhada. Tabela equivalente abaixo.`} tableId={tableId} />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-faint">
        <span><span className="text-primary-600">━</span> consolidada</span>
        <span><span className="text-attention-700">╌</span> provisória (sujeita a revisão)</span>
        {nc && <span><span className="text-h1n1">◆ ┈</span> nowcast: estimativa de notificações ainda não digitadas; método na metodologia</span>}
        {nowcast && !nowcast.ok && <span>nowcast indisponível{nowcast.status === 'not_found' ? ' para este recorte' : ''}</span>}
      </div>
      <details className="mt-3 text-sm">
        <summary className="touch inline-flex cursor-pointer items-center text-[14px] font-medium text-primary-600">Tabela equivalente</summary>
        <div className="mt-2">
          <SeriesTable id={tableId} caption={`${title}, por semana`} obs={obs} unit={unit} periodType={periodType} suppressionThreshold={threshold} compact />
          {nc && (
            <table className="data-table mt-3 text-xs">
              <caption>Nowcast: {nc.note}</caption>
              <thead>
                <tr>
                  <th scope="col">Semana</th>
                  <th scope="col" className="text-right">Observado</th>
                  <th scope="col" className="text-right">Já digitado</th>
                  <th scope="col" className="text-right">Estimativa</th>
                  <th scope="col" className="text-right">Faixa</th>
                </tr>
              </thead>
              <tbody>
                {nc.results.map((r) => (
                  <tr key={r.period}>
                    <th scope="row" className="font-normal">{formatPeriod(r.period, periodType)}</th>
                    <td className="num">{fmt(r.observed)}</td>
                    <td className="num">{(r.reported_share * 100).toFixed(0)}%</td>
                    <td className="num">{fmt(r.estimated)}</td>
                    <td className="num">{fmt(r.lower)}–{fmt(r.upper)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>
    </div>
  );
}
