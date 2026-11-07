'use client';
import dynamic from 'next/dynamic';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import type { ApiResult, NowcastResult, SeriesObservation } from '@/lib/api';
import { CHART_COLORS, SERIES_COLORS } from '@/lib/echarts-theme';
import { formatNumberBR, formatPeriod, shortPeriod } from '@/lib/format';
import { publishedValue } from '@/lib/series';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';
import { SeriesTable } from '@/components/charts/SeriesTable';
import { NOTE, SUMMARY, TABLE } from '@/components/charts/ui';

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

/**
 * Série semanal sobre papel: semanas consolidadas em linha cheia (cobalto), cauda PROVISÓRIA tracejada em âmbar
 * escuro com faixa rotulada e legenda em texto; lacunas para células suprimidas; nowcast opcional (faixa +
 * estimativa pontilhada em rosa). A tabela equivalente fica em "Ver como tabela".
 */
export function TrendChart({ obs, unit, title, periodType, threshold, nowcast, tableId, height = 320 }: Props) {
  const periods = obs.map((o) => o.period);
  const firstProv = obs.findIndex((o) => o.update_status === 'provisional');
  // a cauda provisória começa na última semana consolidada (o trecho que leva ao 1.º valor provisório é tracejado)
  const finalLine = obs.map((o) => (o.update_status === 'final' ? publishedValue(o) : null));
  // o ponto consolidado que liga as duas linhas não ganha marcador na série provisória (o círculo cheio já está na consolidada)
  const provLine = obs.map((o, i) => {
    if (o.update_status === 'provisional') return publishedValue(o);
    return firstProv > 0 && i === firstProv - 1 ? { value: publishedValue(o), symbol: 'none' } : null;
  });
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
        const status = o.update_status === 'provisional' ? `· <span style="color:${CHART_COLORS.attention}">provisório</span>` : '· consolidado';
        const lines = [`<strong>${formatPeriod(o.period, periodType)}</strong>`, `${o.suppressed ? `&lt;${threshold}, ocultado por privacidade` : fmt(publishedValue(o))} ${status}`];
        if (r) lines.push(`nowcast: ${fmt(r.estimated)} (${fmt(r.lower)}–${fmt(r.upper)}) · ${(r.reported_share * 100).toFixed(0)}% já digitado`);
        return lines.join('<br/>');
      },
    },
    legend: { show: false },
    grid: { left: 56, right: 16, top: 24, bottom: 36 },
    xAxis: { type: 'category', data: periods, axisLabel: { formatter: (v: string) => shortPeriod(v), interval: Math.max(0, Math.ceil(periods.length / 13) - 1) } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumberBR(v, unit) }, min: 0 },
    series: [
      ...(nc
        ? ([
            { name: 'Nowcast (base)', type: 'line', data: lower, stack: 'nc', lineStyle: { opacity: 0 }, symbol: 'none', silent: true, tooltip: { show: false } },
            { name: 'Nowcast (faixa)', type: 'line', data: band, stack: 'nc', lineStyle: { opacity: 0 }, areaStyle: { color: SERIES_COLORS.nowcast, opacity: 0.16 }, symbol: 'none', silent: true, tooltip: { show: false } },
            { name: 'Nowcast (estimativa)', type: 'line', data: estimate, lineStyle: { type: 'dotted', width: 2, color: SERIES_COLORS.nowcast }, itemStyle: { color: SERIES_COLORS.nowcast }, symbol: 'diamond', symbolSize: 8, connectNulls: true },
          ] as LineSeriesOption[])
        : []),
      {
        name: 'Consolidada',
        type: 'line',
        data: finalLine,
        lineStyle: { width: 2.5, color: SERIES_COLORS.final },
        itemStyle: { color: SERIES_COLORS.final },
        symbolSize: 5,
      },
      {
        name: 'Provisória',
        type: 'line',
        data: provLine,
        lineStyle: { width: 2.5, type: 'dashed', color: SERIES_COLORS.provisional },
        itemStyle: { color: SERIES_COLORS.provisional, borderColor: SERIES_COLORS.provisional, borderWidth: 2 },
        // círculo vazado: o provisório também se distingue pela forma, não só pela cor
        symbol: 'emptyCircle',
        symbolSize: 7,
        ...(firstProv >= 0
          ? {
              markArea: {
                silent: true,
                itemStyle: { color: SERIES_COLORS.provisional, opacity: 0.12 },
                label: { show: true, position: 'insideTopRight', formatter: 'provisória', color: CHART_COLORS.attention, fontSize: 12 },
                data: [[{ xAxis: periods[Math.max(0, firstProv)] }, { xAxis: periods[periods.length - 1] }] as [{ xAxis: string | undefined }, { xAxis: string | undefined }]],
              },
            }
          : {}),
      },
    ],
  };

  return (
    <div>
      <EChart option={option} height={height} ariaLabel={`${title}, por semana; semanas provisórias tracejadas em âmbar${nc ? '; nowcast como faixa e estimativa pontilhada' : ''}. Tabela equivalente abaixo.`} tableId={tableId} />
      <ul className={`mt-3 flex flex-wrap gap-x-6 gap-y-2 ${NOTE}`} aria-label="Legenda do gráfico">
        <li className="inline-flex items-center gap-2">
          <svg width="30" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="30" y2="5" stroke={SERIES_COLORS.final} strokeWidth="2.5" />
          </svg>
          semana consolidada
        </li>
        <li className="inline-flex items-center gap-2">
          <svg width="30" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="30" y2="5" stroke={SERIES_COLORS.provisional} strokeWidth="2.5" strokeDasharray="6 4" />
          </svg>
          cauda provisória, sujeita a revisão
        </li>
        {nc && (
          <li className="inline-flex items-center gap-2">
            <svg width="30" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="30" y2="5" stroke={SERIES_COLORS.nowcast} strokeWidth="2" strokeDasharray="2 3" />
            </svg>
            nowcast: estimativa de notificações ainda não digitadas (método na metodologia)
          </li>
        )}
        {nowcast && !nowcast.ok && <li>nowcast indisponível{nowcast.status === 'not_found' ? ' para este recorte' : ''}</li>}
      </ul>
      <details className="mt-4">
        <summary className={SUMMARY}>Ver como tabela</summary>
        <div className="mt-3">
          <SeriesTable id={tableId} caption={`${title}, por semana`} obs={obs} unit={unit} periodType={periodType} suppressionThreshold={threshold} compact />
          {nc && (
            <table className={`${TABLE} mt-4`}>
              <caption>Nowcast: {nc.note}</caption>
              <thead>
                <tr>
                  <th scope="col">Semana</th>
                  <th scope="col" className="text-right!">
                    Observado
                  </th>
                  <th scope="col" className="text-right!">
                    Já digitado
                  </th>
                  <th scope="col" className="text-right!">
                    Estimativa
                  </th>
                  <th scope="col" className="text-right!">
                    Faixa
                  </th>
                </tr>
              </thead>
              <tbody>
                {nc.results.map((r) => (
                  <tr key={r.period}>
                    <th scope="row" className="font-normal">
                      {formatPeriod(r.period, periodType)}
                    </th>
                    <td className="num">{fmt(r.observed)}</td>
                    <td className="num">{(r.reported_share * 100).toFixed(0)}%</td>
                    <td className="num">{fmt(r.estimated)}</td>
                    <td className="num">
                      {fmt(r.lower)}–{fmt(r.upper)}
                    </td>
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
