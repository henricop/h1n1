'use client';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { ECHARTS_THEME, ECHARTS_THEME_NAME } from '@/lib/echarts-theme';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, DataZoomComponent, CanvasRenderer]);
echarts.registerTheme(ECHARTS_THEME_NAME, ECHARTS_THEME as unknown as Record<string, unknown>);

interface Props {
  option: EChartsOption;
  height: number;
  ariaLabel: string;
  /** id da tabela equivalente (aria-describedby). */
  tableId?: string;
}

/** Wrapper do ECharts (tema escuro do HUD, canvas, redimensionável). Carregar só no cliente via next/dynamic. */
export default function EChart({ option, height, ariaLabel, tableId }: Props) {
  return (
    <div role="img" aria-label={ariaLabel} aria-describedby={tableId} style={{ height }}>
      <ReactEChartsCore echarts={echarts} option={option} theme={ECHARTS_THEME_NAME} notMerge lazyUpdate style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  );
}
