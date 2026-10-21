/**
 * Temas por seção (DESIGN.md v3 / docs/reformulacao-v4.md §7). Módulo puro no servidor; no cliente guarda a
 * cor VIVA do fundo (`live`), lida por quadro pelo palco 3D, e permite assinar mudanças.
 *
 * Esqueleto compartilhado (núcleo): a frente A substitui `setTheme` por uma versão interpolada com GSAP
 * (sRGB, tinta trocando de uma vez quando a luminância do fundo cruza 0,18) e mantém esta API.
 */
export type ThemeName = 'paper' | 'deep' | 'warm';

export interface ThemeRGB {
  r: number;
  g: number;
  b: number;
}

/** Variáveis que diferem do tema `paper` (valores idênticos aos de globals.css; test/shell.test.ts compara). */
export const THEMES: Readonly<Record<ThemeName, Readonly<Record<string, string>>>> = {
  paper: {
    '--color-bg': '#f4f1ea',
    '--color-paper': '#f4f1ea',
    '--color-bg-soft': '#ece8df',
    '--color-paper-2': '#ece8df',
    '--color-bg-tint': '#eef3ff',
    '--color-card': '#fbfaf7',
    '--color-veil': 'rgba(244, 241, 234, 0.92)',
    '--color-line': '#dcd7cb',
    '--color-line-strong': '#8a8475',
    '--color-ink': '#14130f',
    '--color-muted': '#4d4a42',
    '--color-faint': '#625e55',
    '--color-primary-700': '#1e3fae',
    '--color-primary-600': '#2451d6',
    '--color-primary-100': '#dbe5ff',
    '--color-primary-50': '#eef3ff',
  },
  deep: {
    '--color-bg': '#0b1a2e',
    '--color-paper': '#0b1a2e',
    '--color-bg-soft': '#10233b',
    '--color-paper-2': '#10233b',
    '--color-bg-tint': '#16305a',
    '--color-card': '#10233b',
    '--color-veil': 'rgba(244, 241, 234, 0.96)',
    '--color-line': 'rgba(244, 241, 234, 0.18)',
    '--color-line-strong': 'rgba(244, 241, 234, 0.36)',
    '--color-ink': '#f4f1ea',
    '--color-muted': '#c9d2e3',
    '--color-faint': '#a7b3c8',
    '--color-primary-700': '#b7ccff',
    '--color-primary-600': '#8fb0ff',
    '--color-primary-100': '#1d3a6b',
    '--color-primary-50': '#16305a',
  },
  warm: {
    '--color-bg': '#f7e8d5',
    '--color-paper': '#f7e8d5',
    '--color-bg-soft': '#f0dcc2',
    '--color-paper-2': '#f0dcc2',
    '--color-bg-tint': '#eef3ff',
    '--color-card': '#fdf6ec',
    '--color-veil': 'rgba(247, 232, 213, 0.92)',
    '--color-line': '#e2cfb5',
    '--color-line-strong': '#c9b092',
    '--color-ink': '#14130f',
    '--color-muted': '#4d4a42',
    '--color-faint': '#625e55',
    '--color-primary-700': '#1e3fae',
    '--color-primary-600': '#2451d6',
    '--color-primary-100': '#dbe5ff',
    '--color-primary-50': '#eef3ff',
  },
};

/** Cor de fundo (sRGB 0–255) de cada tema; o palco 3D lê `live` por quadro. */
export const THEME_BG: Readonly<Record<ThemeName, Readonly<ThemeRGB>>> = {
  paper: { r: 244, g: 241, b: 234 },
  deep: { r: 11, g: 26, b: 46 },
  warm: { r: 247, g: 232, b: 213 },
};

/** `<meta name="theme-color">` por tema. */
export const THEME_META: Readonly<Record<ThemeName, string>> = { paper: '#f4f1ea', deep: '#0b1a2e', warm: '#f7e8d5' };

export function isThemeName(x: unknown): x is ThemeName {
  return x === 'paper' || x === 'deep' || x === 'warm';
}

export function hexToRgb(hex: string): ThemeRGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Luminância relativa (WCAG) de uma cor sRGB 0–255. */
export function relativeLuminance({ r, g, b }: ThemeRGB): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Limiar de luminância do fundo em que a tinta troca de escura para clara (contrato §6). */
export const INK_SWITCH_LUMINANCE = 0.18;

/** Tinta adequada a um fundo: clara abaixo do limiar, escura acima. */
export function inkFor(bg: ThemeRGB): 'light' | 'dark' {
  return relativeLuminance(bg) < INK_SWITCH_LUMINANCE ? 'light' : 'dark';
}

/* ---------- estado vivo (cliente) ---------- */

const live: ThemeRGB = { ...THEME_BG.paper };
let current: ThemeName = 'paper';
const subscribers = new Set<(rgb: Readonly<ThemeRGB>, theme: ThemeName) => void>();

/** Objeto MUTÁVEL com a cor de fundo atual (ler por quadro; não copiar). */
export function getLiveTheme(): ThemeRGB {
  return live;
}

export function getCurrentTheme(): ThemeName {
  return current;
}

/** Assina mudanças (chamado a cada quadro de interpolação); devolve a função de cancelamento. */
export function subscribeTheme(cb: (rgb: Readonly<ThemeRGB>, theme: ThemeName) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Escreve `live` e notifica (usado pela interpolação da frente A). */
export function writeLive(rgb: Readonly<ThemeRGB>, theme: ThemeName): void {
  live.r = rgb.r;
  live.g = rgb.g;
  live.b = rgb.b;
  current = theme;
  for (const cb of subscribers) cb(live, theme);
}

/**
 * Troca instantânea de tema (esqueleto): marca `data-theme-current`, atualiza `theme-color` e `live`.
 * A frente A substitui por versão interpolada mantendo a assinatura.
 */
export function setTheme(name: ThemeName): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.setAttribute('data-theme-current', name);
  for (const key of Object.keys(THEMES.paper)) html.style.removeProperty(key);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_META[name];
  writeLive(THEME_BG[name], name);
}
