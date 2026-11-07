'use client';
import { useEffect, useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { ECHARTS_THEME, ECHARTS_THEME_NAME, FONT_MONO_FALLBACK, FONT_SANS_FALLBACK } from '@/lib/echarts-theme';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, DataZoomComponent, CanvasRenderer]);
echarts.registerTheme(ECHARTS_THEME_NAME, ECHARTS_THEME as unknown as Record<string, unknown>);

interface Props {
  option: EChartsOption;
  height: number;
  ariaLabel: string;
  /** id da tabela equivalente (aria-describedby). */
  tableId?: string;
}

interface Fonts {
  sans: string;
  mono: string;
}

/**
 * O canvas não resolve `var(--font-*)`: lemos as famílias reais (next/font, auto-hospedadas) do `<html>` e
 * redesenhamos quando elas terminam de carregar. Antes disso valem as famílias de reserva.
 */
function useChartFonts(): Fonts {
  const [fonts, setFonts] = useState<Fonts>({ sans: FONT_SANS_FALLBACK, mono: FONT_MONO_FALLBACK });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const sans = cs.getPropertyValue('--font-sans').trim() || FONT_SANS_FALLBACK;
    const mono = cs.getPropertyValue('--font-mono').trim() || FONT_MONO_FALLBACK;
    let alive = true;
    const apply = () => alive && setFonts((f) => (f.sans === sans && f.mono === mono ? f : { sans, mono }));
    apply();
    const fontSet = document.fonts;
    if (fontSet?.load) {
      Promise.all([fontSet.load(`14px ${sans}`), fontSet.load(`12px ${mono}`)]).then(() => alive && setFonts({ sans, mono })).catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, []);
  return fonts;
}

type AxisLike = Record<string, unknown>;
const asList = (a: unknown): AxisLike[] => (Array.isArray(a) ? (a as AxisLike[]) : a ? [a as AxisLike] : []);

/** Aplica as famílias reais: Inter no texto geral, JetBrains Mono nos rótulos de eixo. */
function withFonts(option: EChartsOption, fonts: Fonts): EChartsOption {
  const axis = (a: unknown) => {
    const list = asList(a).map((x) => ({ ...x, axisLabel: { fontFamily: fonts.mono, ...((x.axisLabel as object) ?? {}) }, nameTextStyle: { fontFamily: fonts.mono, ...((x.nameTextStyle as object) ?? {}) } }));
    return Array.isArray(a) ? list : list[0];
  };
  const out: Record<string, unknown> = { ...option, textStyle: { fontFamily: fonts.sans, ...((option.textStyle as object) ?? {}) } };
  if (option.xAxis) out.xAxis = axis(option.xAxis);
  if (option.yAxis) out.yAxis = axis(option.yAxis);
  return out as EChartsOption;
}

/** Wrapper do ECharts (tema de papel, canvas, redimensionável). Carregar só no cliente via next/dynamic. */
export default function EChart({ option, height, ariaLabel, tableId }: Props) {
  const fonts = useChartFonts();
  const merged = useMemo(() => withFonts(option, fonts), [option, fonts]);
  return (
    <div role="img" aria-label={ariaLabel} aria-describedby={tableId} style={{ height }}>
      <ReactEChartsCore echarts={echarts} option={merged} theme={ECHARTS_THEME_NAME} notMerge lazyUpdate style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} />
    </div>
  );
}
