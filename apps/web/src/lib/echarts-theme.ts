/** Tema escuro da sala de situação para ECharts (mesmos tokens de globals.css). Registrado uma vez no cliente. */
export const HUD_COLORS = {
  bg950: '#05080f',
  bg900: '#0a0f1a',
  bg800: '#111827',
  line: '#233047',
  lineStrong: '#34507a',
  ink: '#e6edf7',
  muted: '#9fb0c7',
  faint: '#6b7a93',
  signal: '#35e0ff',
  signalDim: '#1aa7c2',
  h1n1: '#ff4fd8',
  h3: '#8b7cff',
  infb: '#4fd1a5',
  srag: '#ffd166',
  gray: '#7d8aa3',
  urgent: '#ff5c5c',
} as const;

export const ECHARTS_THEME_NAME = 'h1n1-hud';

export const ECHARTS_THEME = {
  color: [HUD_COLORS.signal, HUD_COLORS.h1n1, HUD_COLORS.h3, HUD_COLORS.infb, HUD_COLORS.srag, HUD_COLORS.gray],
  backgroundColor: 'transparent',
  textStyle: { color: HUD_COLORS.muted, fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 },
  title: { textStyle: { color: HUD_COLORS.ink, fontFamily: 'Space Grotesk, Inter, system-ui, sans-serif', fontWeight: 600, fontSize: 14 }, subtextStyle: { color: HUD_COLORS.faint } },
  legend: { textStyle: { color: HUD_COLORS.muted }, inactiveColor: HUD_COLORS.line, pageTextStyle: { color: HUD_COLORS.muted } },
  tooltip: {
    backgroundColor: 'rgba(10,15,26,0.96)',
    borderColor: HUD_COLORS.lineStrong,
    borderWidth: 1,
    textStyle: { color: HUD_COLORS.ink, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 12 },
    axisPointer: { lineStyle: { color: HUD_COLORS.signalDim }, crossStyle: { color: HUD_COLORS.signalDim } },
  },
  categoryAxis: { axisLine: { lineStyle: { color: HUD_COLORS.line } }, axisTick: { lineStyle: { color: HUD_COLORS.line } }, axisLabel: { color: HUD_COLORS.faint }, splitLine: { show: false } },
  valueAxis: { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: HUD_COLORS.faint }, splitLine: { lineStyle: { color: HUD_COLORS.line, type: 'dashed' } } },
  line: { smooth: false, symbol: 'circle', symbolSize: 4, lineStyle: { width: 2 } },
  grid: { left: 48, right: 16, top: 28, bottom: 36, containLabel: false },
} as const;
