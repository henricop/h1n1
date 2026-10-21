/**
 * Formatação de saída do terminal (puro): tabelas mono, sparkline ASCII, células suprimidas e rodapé de metadados.
 * Regra: célula suprimida NUNCA revela o valor (sempre "<N"); ausência é "—", nunca zero.
 */

export type BlockKind = 'text' | 'table' | 'meta' | 'warn' | 'error' | 'ok';

export interface OutputBlock {
  kind: BlockKind;
  lines: string[];
}

export type TerminalAction = { type: 'navigate'; href: string } | { type: 'open'; url: string } | { type: 'clear' };

export interface CommandOutput {
  blocks: OutputBlock[];
  action?: TerminalAction;
}

export const block = (kind: BlockKind, lines: string[]): OutputBlock => ({ kind, lines });
export const text = (...lines: string[]): OutputBlock => block('text', lines);
export const error = (...lines: string[]): OutputBlock => block('error', lines);
export const warn = (...lines: string[]): OutputBlock => block('warn', lines);

export interface CellLike {
  value: number | null;
  suppressed: boolean;
}

/** Valor publicável de uma célula: suprimida → "<limiar"; sem valor → "—". */
export function formatCell(cell: CellLike, threshold = 5, unit?: string): string {
  if (cell.suppressed) return `<${threshold > 0 ? threshold : 5}`;
  if (cell.value === null || cell.value === undefined || Number.isNaN(cell.value)) return '—';
  return formatNumber(cell.value, unit);
}

export function formatNumber(value: number, unit?: string): string {
  const s = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: unit === 'percent' ? 1 : 0 }).format(value);
  return unit === 'percent' ? `${s}%` : s;
}

const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

/**
 * Sparkline ASCII. `null` (suprimido ou ausente) vira '·' e nunca participa da escala.
 */
export function sparkline(values: ReadonlyArray<number | null>): string {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return values.map(() => '·').join('');
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  return values
    .map((v) => {
      if (v === null || !Number.isFinite(v)) return '·';
      if (span === 0) return BARS[3];
      const idx = Math.round(((v - min) / span) * (BARS.length - 1));
      return BARS[Math.max(0, Math.min(BARS.length - 1, idx))];
    })
    .join('');
}

export type Align = 'l' | 'r';

/** Tabela mono com cabeçalho e separador; colunas alinhadas conforme `align` (padrão: esquerda). */
export function table(headers: string[], rows: string[][], align: Align[] = []): string[] {
  const cols = headers.length;
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const fmt = (cells: string[]) =>
    cells
      .slice(0, cols)
      .map((c, i) => (align[i] === 'r' ? c.padStart(widths[i]!) : c.padEnd(widths[i]!)))
      .join('  ')
      .trimEnd();
  const sep = widths.map((w) => '─'.repeat(w)).join('──');
  return [fmt(headers), sep, ...rows.map((r) => fmt(r))];
}

export interface MetadataInput {
  source?: { name: string; url?: string | null; license?: string | null } | null;
  data_as_of?: string | null;
  universe_note?: string | null;
  case_definition?: string | null;
  suppression_threshold?: number | null;
  provisional?: boolean;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
export function dateBR(value: string | null | undefined): string {
  if (!value) return 'não informada';
  const m = DATE_RE.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** Rodapé obrigatório em qualquer saída numérica: fonte · base · universo (+ definição de caso e supressão). */
export function metadataFooter(m: MetadataInput): OutputBlock {
  const lines: string[] = [];
  lines.push(`fonte: ${m.source?.name ?? 'não informada'}${m.source?.license ? ` · licença: ${m.source.license}` : ''}`);
  if (m.source?.url) lines.push(`url: ${m.source.url}`);
  lines.push(`base de: ${dateBR(m.data_as_of)}`);
  lines.push(`universo: ${m.universe_note?.trim() || 'não informado pela API'}`);
  if (m.case_definition) lines.push(`definição de caso: ${m.case_definition}`);
  if (m.suppression_threshold && m.suppression_threshold > 0) lines.push(`supressão: células abaixo de ${m.suppression_threshold} em recortes por UF ou estrato aparecem como "<${m.suppression_threshold}".`);
  if (m.provisional) lines.push('semanas marcadas com * são provisórias e tendem a subir em revisões.');
  return block('meta', lines);
}

/** Quebra um texto longo em linhas de até `width` colunas (para o rodapé de universo). */
export function wrap(line: string, width = 100): string[] {
  const words = line.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width && cur) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}
