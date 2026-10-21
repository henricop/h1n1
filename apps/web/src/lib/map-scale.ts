/**
 * Escalas visuais da sala de situação (puras, testáveis):
 * - mapa de UFs: sequencial do tint do primário (baixo) ao rosa forte A(H1N1)pdm09 (alto) sobre fundo claro; nulo/suprimido → hachura.
 * - globo: raio por raiz quadrada (sqrt) do valor, para que áreas sejam proporcionais ao dado.
 */

export const MAP_COLOR_LOW = '#eef3ff'; // primary-50
export const MAP_COLOR_HIGH = '#d6007f'; // h1n1 (rosa forte)
export const MAP_COLOR_ZERO = '#e3e8f0'; // line: zero publicado (visível sobre bg-soft, distinto de "sem dado")
export const MAP_COLOR_NODATA = 'url(#hatch-nodata)';

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

export type MapCell = { kind: 'value'; value: number; t: number; fill: string } | { kind: 'zero'; fill: string } | { kind: 'suppressed'; fill: string } | { kind: 'nodata'; fill: string };

/**
 * Classifica uma célula do mapa. `max` é o maior valor publicado da semana (ou do período, para escala fixa).
 * - suprimida → hachura (nunca cor nem valor);
 * - null (não publicada) → hachura;
 * - 0 → cor de zero (distinta de "sem dado");
 * - > 0 → cor por sqrt(value/max).
 */
export function mapCell(value: number | null, suppressed: boolean, max: number): MapCell {
  if (suppressed) return { kind: 'suppressed', fill: MAP_COLOR_NODATA };
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

/** Pontos de legenda (5 passos) para a escala do mapa. */
export function legendStops(max: number): Array<{ value: number; fill: string }> {
  const ts = [0.05, 0.25, 0.5, 0.75, 1];
  return ts.map((t) => ({ value: Math.round(t * t * max), fill: mixHex(MAP_COLOR_LOW, MAP_COLOR_HIGH, t) }));
}
