/**
 * Escalas visuais do mapa e do globo (puras, testáveis):
 * - mapa de UFs: sequencial do rosa claro ao rosa A(H1N1)pdm09 sobre o papel (cor ∝ √valor);
 *   "<5" (suprimido) = HACHURA diagonal; "sem dado publicado" = PONTILHADO; zero = cor chapada própria.
 *   Suprimido e sem dado nunca compartilham o mesmo desenho (não é o mesmo que "zero" nem que "sem dado").
 * - globo: raio por raiz quadrada (sqrt) do valor, para que áreas sejam proporcionais ao dado.
 */

export const MAP_COLOR_LOW = '#fbe3ef'; // rosa muito claro (h1n1 a ~12 %)
export const MAP_COLOR_HIGH = '#d6007f'; // h1n1 (rosa forte)
export const MAP_COLOR_ZERO = '#e6e1d4'; // zero publicado: papel escuro chapado, distinto do pontilhado de "sem dado"
/** Ids dos <pattern> definidos dentro do SVG do mapa (e de cada amostra da legenda). */
export const MAP_COLOR_SUPPRESSED = 'url(#hatch-suppressed)';
export const MAP_COLOR_NODATA = 'url(#dots-nodata)';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Interpolação linear em sRGB entre duas cores hex; t em [0,1]. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = Math.min(1, Math.max(0, t));
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminância relativa (WCAG) de uma cor hex. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Cor de texto legível (tinta ou branco) sobre um fundo hex: a de maior contraste. */
export function textOn(hex: string): '#14130f' | '#ffffff' {
  const l = relativeLuminance(hex);
  const withInk = (l + 0.05) / (relativeLuminance('#14130f') + 0.05);
  const withWhite = 1.05 / (l + 0.05);
  return withInk >= withWhite ? '#14130f' : '#ffffff';
}

export type MapCell =
  | { kind: 'value'; value: number; t: number; fill: string }
  | { kind: 'zero'; fill: string }
  | { kind: 'suppressed'; fill: string }
  | { kind: 'nodata'; fill: string };

/**
 * Classifica uma célula do mapa. `max` é o maior valor publicado da semana (ou do período, para escala fixa).
 * - suprimida → hachura (nunca cor nem valor);
 * - null (não publicada) → pontilhado ("sem dado"), diferente da hachura;
 * - 0 → cor de zero (distinta de "sem dado");
 * - > 0 → cor por sqrt(value/max).
 */
export function mapCell(value: number | null, suppressed: boolean, max: number): MapCell {
  if (suppressed) return { kind: 'suppressed', fill: MAP_COLOR_SUPPRESSED };
  if (value === null || value === undefined || Number.isNaN(value)) return { kind: 'nodata', fill: MAP_COLOR_NODATA };
  if (value <= 0) return { kind: 'zero', fill: MAP_COLOR_ZERO };
  const t = max > 0 ? Math.sqrt(Math.min(value, max) / max) : 0;
  return { kind: 'value', value, t, fill: mixHex(MAP_COLOR_LOW, MAP_COLOR_HIGH, t) };
}

/** Maior valor publicado entre as células (ignora nulos e suprimidos). */
export function maxPublished(values: (number | null)[], suppressed?: boolean[]): number {
  let m = 0;
  values.forEach((v, i) => {
    if (v === null || suppressed?.[i]) return;
    if (v > m) m = v;
  });
  return m;
}

/** Raio (unidade arbitrária) proporcional à raiz quadrada do valor; 0 para nulo/zero. */
export function sqrtRadius(value: number | null, max: number, maxRadius: number, minRadius = 0): number {
  if (value === null || value <= 0 || max <= 0) return 0;
  return Math.max(minRadius, Math.sqrt(value / max) * maxRadius);
}

/**
 * Pontos de legenda (até 5 passos) para a escala do mapa, gerados dos dados: valores inteiros, crescentes e
 * sem repetição (com `max` pequeno a legenda tem menos passos em vez de repetir "0").
 */
export function legendStops(max: number): Array<{ value: number; fill: string }> {
  const ts = [0.05, 0.25, 0.5, 0.75, 1];
  const out: Array<{ value: number; fill: string }> = [];
  for (const t of ts) {
    const value = Math.round(t * t * max);
    if (value < 1 || out.some((s) => s.value === value)) continue;
    out.push({ value, fill: mixHex(MAP_COLOR_LOW, MAP_COLOR_HIGH, t) });
  }
  return out;
}
