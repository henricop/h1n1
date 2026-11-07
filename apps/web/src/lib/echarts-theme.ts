/**
 * Tema dos gráficos ECharts sobre papel (v3 "papel, cinema, dado"): fundo transparente, grade suave, sem neon.
 * Cores de LINHA verificadas com ≥ 3:1 sobre o papel (#f4f1ea) e sobre o cartão (#fbfaf7) — WCAG 1.4.11:
 * primary 5,8:1 · h1n1 4,5:1 · h3 4,1:1 · infb 4,3:1 (escurecido de #0f9f93, que tinha 2,9:1) ·
 * srag/provisório 3,7:1 (escurecido de #f29a0a, que tinha 2,0:1) · gray 4,1:1.
 * As mesmas cores servem aos SVG (LineChart, Sparkline) e ao mapa.
 */
export const CHART_COLORS = {
  paper: '#f4f1ea',
  card: '#fbfaf7',
  /** Grade suave. */
  line: '#dcd7cb',
  /** Eixos e contornos (3,3:1 sobre o papel). */
  lineStrong: '#8a8475',
  ink: '#14130f',
  muted: '#4d4a42',
  faint: '#625e55',
  /** Dado principal (cobalto): série consolidada. */
  primary: '#2451d6',
  primaryDark: '#1e3fae',
  /** A(H1N1)pdm09. */
  h1n1: '#d6007f',
  /** A(H3). */
  h3: '#6d5df6',
  /** Influenza B (verde-água escurecido para contraste). */
  infb: '#0b7f75',
  /** SRAG total e semanas provisórias (âmbar escurecido para contraste). */
  srag: '#b36a00',
  /** Âmbar de texto (provisório em texto corrido). */
  attention: '#9a5b00',
  /** Influenza A sem subtipo e demais séries neutras. */
  gray: '#7a7466',
  urgent: '#b42318',
} as const;

/** Cores da composição FluNet (H1N1, H3, A sem subtipo, B). Fica aqui, e não no componente 'use client', para o servidor ler o valor (e não uma referência de cliente). */
export const COMPOSITION_COLORS = { h1n1: CHART_COLORS.h1n1, h3: CHART_COLORS.h3, nsub: CHART_COLORS.gray, infb: CHART_COLORS.infb } as const;

/** Cor da série consolidada e da provisória (dash) em todos os gráficos. */
export const SERIES_COLORS = { final: CHART_COLORS.primary, provisional: CHART_COLORS.srag, nowcast: CHART_COLORS.h1n1 } as const;

/** Famílias de reserva: o canvas não resolve `var(--font-*)`, então o EChart lê as famílias reais (next/font) do `<html>` em runtime. */
export const FONT_SANS_FALLBACK = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FONT_MONO_FALLBACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const ECHARTS_THEME_NAME = 'h1n1-papel';

export const ECHARTS_THEME = {
  color: [CHART_COLORS.primary, CHART_COLORS.h1n1, CHART_COLORS.h3, CHART_COLORS.infb, CHART_COLORS.srag, CHART_COLORS.gray],
  backgroundColor: 'transparent',
  textStyle: { color: CHART_COLORS.muted, fontFamily: FONT_SANS_FALLBACK, fontSize: 14 },
  title: { textStyle: { color: CHART_COLORS.ink, fontFamily: FONT_SANS_FALLBACK, fontWeight: 600, fontSize: 16 }, subtextStyle: { color: CHART_COLORS.faint } },
  legend: { textStyle: { color: CHART_COLORS.muted, fontSize: 14 }, inactiveColor: CHART_COLORS.line, pageTextStyle: { color: CHART_COLORS.muted }, itemGap: 18 },
  tooltip: {
    backgroundColor: CHART_COLORS.card,
    borderColor: CHART_COLORS.line,
    borderWidth: 1,
    textStyle: { color: CHART_COLORS.ink, fontFamily: FONT_SANS_FALLBACK, fontSize: 14 },
    extraCssText: 'box-shadow: 0 10px 40px -16px rgba(20,19,15,.22); border-radius: 14px; padding: 10px 12px; line-height: 1.5;',
    axisPointer: { lineStyle: { color: CHART_COLORS.lineStrong }, crossStyle: { color: CHART_COLORS.lineStrong } },
  },
  // rótulos de eixo são a exceção do piso de 14 px: 12 px em mono
  categoryAxis: { axisLine: { lineStyle: { color: CHART_COLORS.lineStrong } }, axisTick: { lineStyle: { color: CHART_COLORS.lineStrong } }, axisLabel: { color: CHART_COLORS.muted, fontSize: 12 }, splitLine: { show: false } },
  valueAxis: { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: CHART_COLORS.muted, fontSize: 12 }, splitLine: { lineStyle: { color: CHART_COLORS.line, type: 'solid' } }, nameTextStyle: { color: CHART_COLORS.faint, fontSize: 12 } },
  line: { smooth: false, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2.5 } },
  grid: { left: 52, right: 16, top: 24, bottom: 36, containLabel: false },
} as const;
