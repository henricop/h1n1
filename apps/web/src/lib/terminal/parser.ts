/**
 * Parser do terminal de consulta epidemiológica (puro, sem I/O; importável no cliente e no servidor).
 * Linha → tokens (aspas simples/duplas) → comando + argumentos posicionais + argumentos nomeados (chave=valor).
 * Erros são mensagens amigáveis em pt-BR, nunca exceções.
 */

export interface CommandSpec {
  name: string;
  usage: string;
  summary: string;
  /** Argumentos posicionais: nome e obrigatoriedade. */
  positional: Array<{ name: string; required: boolean }>;
  /** Chaves aceitas em `chave=valor`. */
  named: string[];
  /** Executado no cliente (sem chamada à API). */
  local?: boolean;
}

export const COMMANDS: readonly CommandSpec[] = [
  { name: 'help', usage: 'help [comando]', summary: 'Lista os comandos ou detalha um comando.', positional: [{ name: 'comando', required: false }], named: [], local: true },
  { name: 'ind', usage: 'ind [filtro]', summary: 'Lista indicadores com id, nome e fonte.', positional: [{ name: 'filtro', required: false }], named: [] },
  {
    name: 'series',
    usage: 'series <indicador> [geo=BRA|BR-SP] [de=2026-W01] [ate=2026-W43]',
    summary: 'Série semanal com tabela, sparkline e metadados (fonte, base, universo).',
    positional: [{ name: 'indicador', required: true }],
    named: ['geo', 'de', 'ate'],
  },
  {
    name: 'top',
    usage: 'top uf <indicador> [semana]',
    summary: 'Ranking de UFs em uma semana (padrão: última semana publicada).',
    positional: [
      { name: 'uf', required: true },
      { name: 'indicador', required: true },
      { name: 'semana', required: false },
    ],
    named: [],
  },
  {
    name: 'nowcast',
    usage: 'nowcast [indicador] [geo]',
    summary: 'Estimativa de nowcast (/v1/analytics/nowcast), quando disponível.',
    positional: [
      { name: 'indicador', required: false },
      { name: 'geo', required: false },
    ],
    named: [],
  },
  { name: 'sinais', usage: 'sinais [indicador]', summary: 'Sinais estatísticos EARS (/v1/analytics/ears). Sinal estatístico, não surto confirmado.', positional: [{ name: 'indicador', required: false }], named: [] },
  { name: 'fontes', usage: 'fontes [P0|P1|P2]', summary: 'Catálogo de fontes oficiais por prioridade.', positional: [{ name: 'prioridade', required: false }], named: [] },
  { name: 'status', usage: 'status', summary: 'Frescor dos indicadores (/v1/freshness).', positional: [], named: [] },
  { name: 'csv', usage: 'csv <indicador> [geo]', summary: 'Abre o download CSV da série (/v1/series.csv).', positional: [{ name: 'indicador', required: true }, { name: 'geo', required: false }], named: [] },
  { name: 'abrir', usage: 'abrir <rota>', summary: 'Navega para uma rota do site (ex.: abrir /dados/brasil/).', positional: [{ name: 'rota', required: true }], named: [], local: true },
  { name: 'clear', usage: 'clear', summary: 'Limpa a tela.', positional: [], named: [], local: true },
];

export interface ParsedCommand {
  name: string;
  positional: string[];
  named: Record<string, string>;
  raw: string;
}

export type ParseResult = { ok: true; command: ParsedCommand } | { ok: false; error: string };

export const GEO_RE = /^([A-Z]{3}|BR-[A-Z]{2})$/;
/** Rota interna aceita por `abrir`: barra inicial, minúsculas/dígitos/hífen/barra e query simples; nada de //, \\ ou esquemas. */
export const INTERNAL_ROUTE_RE = /^\/[a-z0-9\-\/]*(\?[a-z0-9=&\-_.]*)?$/;
export function isInternalRoute(route: string): boolean {
  return !route.startsWith('//') && !route.includes('\\') && INTERNAL_ROUTE_RE.test(route);
}
export const PERIOD_RE = /^\d{4}(-W\d{2})?$/;
export const INDICATOR_ID_RE = /^[a-z0-9_]+$/;
const PRIORITY_RE = /^P[012]$/;

/** Divide a linha em tokens respeitando aspas simples e duplas. Aspas não fechadas são toleradas. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let has = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur || has) tokens.push(cur);
      cur = '';
      has = false;
      continue;
    }
    cur += ch;
  }
  if (cur || has) tokens.push(cur);
  return tokens;
}

export function findCommand(name: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.name === name);
}

function suggest(name: string): string | null {
  const lower = name.toLowerCase();
  const byPrefix = COMMANDS.find((c) => c.name.startsWith(lower) || lower.startsWith(c.name));
  return byPrefix?.name ?? null;
}

function validateArgs(cmd: CommandSpec, positional: string[], named: Record<string, string>): string | null {
  const required = cmd.positional.filter((p) => p.required);
  if (positional.length < required.length) {
    const missing = required[positional.length]!;
    return `Faltou o argumento <${missing.name}>. Uso: ${cmd.usage}`;
  }
  if (positional.length > cmd.positional.length) {
    return `Argumentos demais para '${cmd.name}'. Uso: ${cmd.usage}`;
  }
  for (const key of Object.keys(named)) {
    if (!cmd.named.includes(key)) {
      return cmd.named.length
        ? `Argumento nomeado desconhecido '${key}'. Aceitos: ${cmd.named.join(', ')}.`
        : `'${cmd.name}' não aceita argumentos nomeados (recebi '${key}=').`;
    }
    if (named[key] === '') return `Argumento '${key}' sem valor. Uso: ${cmd.usage}`;
  }
  if (named.geo !== undefined && !GEO_RE.test(named.geo)) return `geo inválido '${named.geo}'. Use um código de país (BRA) ou UF (BR-SP).`;
  for (const k of ['de', 'ate'] as const) {
    const v = named[k];
    if (v !== undefined && !PERIOD_RE.test(v)) return `${k} inválido '${v}'. Use AAAA ou AAAA-Www (ex.: 2026-W01).`;
  }
  if (named.de && named.ate && named.de > named.ate) return `Intervalo inválido: de=${named.de} é posterior a ate=${named.ate}.`;

  switch (cmd.name) {
    case 'series':
    case 'csv': {
      const id = positional[0]!;
      if (!INDICATOR_ID_RE.test(id)) return `Indicador inválido '${id}'. Ids usam minúsculas, dígitos e sublinhado (ex.: sivep_srag_ah1n1pdm09_confirmed).`;
      const geo = positional[1];
      if (cmd.name === 'csv' && geo !== undefined && !GEO_RE.test(geo)) return `geo inválido '${geo}'. Use BRA ou BR-UF.`;
      break;
    }
    case 'top': {
      if (positional[0] !== 'uf') return `Subcomando desconhecido '${positional[0]}'. Uso: ${cmd.usage}`;
      const id = positional[1]!;
      if (!INDICATOR_ID_RE.test(id)) return `Indicador inválido '${id}'.`;
      const week = positional[2];
      if (week !== undefined && !/^\d{4}-W\d{2}$/.test(week)) return `Semana inválida '${week}'. Use AAAA-Www (ex.: 2026-W40).`;
      break;
    }
    case 'nowcast': {
      const id = positional[0];
      if (id !== undefined && !INDICATOR_ID_RE.test(id)) return `Indicador inválido '${id}'.`;
      const geo = positional[1];
      if (geo !== undefined && !GEO_RE.test(geo)) return `geo inválido '${geo}'. Use BRA ou BR-UF.`;
      break;
    }
    case 'sinais': {
      const id = positional[0];
      if (id !== undefined && !INDICATOR_ID_RE.test(id)) return `Indicador inválido '${id}'.`;
      break;
    }
    case 'fontes': {
      const p = positional[0];
      if (p !== undefined && !PRIORITY_RE.test(p)) return `Prioridade inválida '${p}'. Use P0, P1 ou P2.`;
      break;
    }
    case 'abrir': {
      const route = positional[0]!;
      if (!isInternalRoute(route)) return `Rota inválida '${route}'. Use um caminho do site, ex.: abrir /dados/brasil/`;
      break;
    }
    case 'help': {
      const c = positional[0];
      if (c !== undefined && !findCommand(c.toLowerCase())) return `Comando desconhecido '${c}'. Digite help para a lista.`;
      break;
    }
  }
  return null;
}

/** Interpreta uma linha. Nunca lança. */
export function parseLine(line: string): ParseResult {
  const raw = line.trim();
  if (!raw) return { ok: false, error: 'Digite um comando. help lista os comandos disponíveis.' };
  const tokens = tokenize(raw);
  const nameTok = tokens[0] ?? '';
  const name = nameTok.toLowerCase();
  const cmd = findCommand(name);
  if (!cmd) {
    const s = suggest(name);
    return { ok: false, error: `Comando desconhecido '${nameTok}'.${s ? ` Você quis dizer '${s}'?` : ''} Digite help para a lista.` };
  }
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const t of tokens.slice(1)) {
    const eq = t.indexOf('=');
    if (eq > 0 && /^[a-zA-Z_]+$/.test(t.slice(0, eq))) {
      named[t.slice(0, eq).toLowerCase()] = normalizeValue(t.slice(0, eq).toLowerCase(), t.slice(eq + 1));
    } else {
      positional.push(normalizePositional(cmd, positional.length, t));
    }
  }
  const error = validateArgs(cmd, positional, named);
  if (error) return { ok: false, error };
  return { ok: true, command: { name: cmd.name, positional, named, raw } };
}

function normalizeValue(key: string, value: string): string {
  if (key === 'geo') return value.toUpperCase();
  if (key === 'de' || key === 'ate') return value.toUpperCase();
  return value;
}

function normalizePositional(cmd: CommandSpec, index: number, value: string): string {
  const spec = cmd.positional[index];
  if (!spec) return value;
  if (spec.name === 'geo' || spec.name === 'prioridade' || spec.name === 'semana') return value.toUpperCase();
  if (spec.name === 'uf' || spec.name === 'comando') return value.toLowerCase();
  return value;
}

/** Texto de ajuda (linhas) para todos os comandos ou para um comando específico. */
export function helpLines(command?: string): string[] {
  if (command) {
    const c = findCommand(command.toLowerCase());
    if (!c) return [`Comando desconhecido '${command}'.`];
    return [`${c.usage}`, `  ${c.summary}`];
  }
  const width = Math.max(...COMMANDS.map((c) => c.usage.length));
  return [
    'Comandos disponíveis (Tab completa; setas navegam o histórico):',
    ...COMMANDS.map((c) => `  ${c.usage.padEnd(width)}  ${c.summary}`),
    '',
    'Toda saída numérica traz fonte, data da base e texto de universo. Células suprimidas aparecem como "<5".',
  ];
}

/**
 * Autocompletar por Tab: completa o nome do comando (primeiro token) ou um id de indicador
 * (posição esperada de indicador) a partir da lista informada.
 */
export function completions(input: string, indicatorIds: readonly string[] = []): string[] {
  const endsWithSpace = /\s$/.test(input);
  const tokens = tokenize(input);
  if (tokens.length === 0) return COMMANDS.map((c) => c.name);
  if (tokens.length === 1 && !endsWithSpace) {
    const prefix = tokens[0]!.toLowerCase();
    return COMMANDS.map((c) => c.name).filter((n) => n.startsWith(prefix));
  }
  const cmd = findCommand(tokens[0]!.toLowerCase());
  if (!cmd) return [];
  const argIndex = endsWithSpace ? tokens.length - 1 : tokens.length - 2;
  const partial = endsWithSpace ? '' : tokens[tokens.length - 1]!;
  if (partial.includes('=')) return [];
  const spec = cmd.positional[argIndex];
  if (spec?.name === 'indicador') return indicatorIds.filter((id) => id.startsWith(partial.toLowerCase()));
  if (spec?.name === 'comando') return COMMANDS.map((c) => c.name).filter((n) => n.startsWith(partial.toLowerCase()));
  if (spec?.name === 'uf') return ['uf'].filter((n) => n.startsWith(partial.toLowerCase()));
  if (spec?.name === 'prioridade') return ['P0', 'P1', 'P2'].filter((n) => n.startsWith(partial.toUpperCase()));
  return [];
}

/** Aplica a melhor conclusão ao input: substitui o último token pelo prefixo comum das opções. */
export function applyCompletion(input: string, options: string[]): string {
  if (options.length === 0) return input;
  const common = options.reduce((acc, o) => {
    let i = 0;
    while (i < acc.length && i < o.length && acc[i] === o[i]) i++;
    return acc.slice(0, i);
  });
  const endsWithSpace = /\s$/.test(input);
  if (endsWithSpace) return `${input}${common}${options.length === 1 ? ' ' : ''}`;
  const idx = input.search(/\S+$/);
  const head = idx === -1 ? input : input.slice(0, idx);
  return `${head}${common}${options.length === 1 ? ' ' : ''}`;
}
