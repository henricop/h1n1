/** Tema claro dos gráficos ECharts (mesmos tokens de globals.css). Registrado uma vez no cliente. */
export const CHART_COLORS = {
  bg: '#ffffff',
  bgSoft: '#f5f7fb',
  line: '#e3e8f0',
  lineStrong: '#c7d0de',
  ink: '#0b1220',
  muted: '#4a5568',
  faint: '#64707f',
  primary: '#2451d6',
  primaryDark: '#1e3fae',
  h1n1: '#d6007f',
  h3: '#6d5df6',
  infb: '#0f9f93',
  srag: '#f29a0a',
  attention: '#9a5b00',
  gray: '#9aa5b4',
  urgent: '#b42318',
} as const;

/** Compatibilidade com componentes anteriores (mesmos nomes de chave; cores do tema claro). */
export const HUD_COLORS = {
  ...CHART_COLORS,
  signal: CHART_COLORS.primary,
  signalDim: CHART_COLORS.primaryDark,
} as const;

export const ECHARTS_THEME_NAME = 'h1n1-claro';

export const ECHARTS_THEME = {
  color: [CHART_COLORS.primary, CHART_COLORS.h1n1, CHART_COLORS.h3, CHART_COLORS.infb, CHART_COLORS.srag, CHART_COLORS.gray],
  backgroundColor: 'transparent',
  textStyle: { color: CHART_COLORS.muted, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 },
  title: { textStyle: { color: CHART_COLORS.ink, fontFamily: 'Manrope, Inter, system-ui, sans-serif', fontWeight: 700, fontSize: 14 }, subtextStyle: { color: CHART_COLORS.faint } },
  legend: { textStyle: { color: CHART_COLORS.muted }, inactiveColor: CHART_COLORS.lineStrong, pageTextStyle: { color: CHART_COLORS.muted } },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: CHART_COLORS.line,
    borderWidth: 1,
    textStyle: { color: CHART_COLORS.ink, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 },
    extraCssText: 'box-shadow: 0 8px 30px -12px rgba(11,18,32,.18); border-radius: 12px;',
    axisPointer: { lineStyle: { color: CHART_COLORS.lineStrong }, crossStyle: { color: CHART_COLORS.lineStrong } },
  },
  categoryAxis: { axisLine: { lineStyle: { color: CHART_COLORS.line } }, axisTick: { lineStyle: { color: CHART_COLORS.line } }, axisLabel: { color: CHART_COLORS.muted }, splitLine: { show: false } },
  valueAxis: { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: CHART_COLORS.muted }, splitLine: { lineStyle: { color: CHART_COLORS.line, type: 'solid' } } },
  line: { smooth: false, symbol: 'circle', symbolSize: 4, lineStyle: { width: 2 } },
  grid: { left: 48, right: 16, top: 28, bottom: 36, containLabel: false },
} as const;
