/**
 * Executor dos comandos do terminal (servidor): usa o cliente tipado src/lib/api.ts e os endpoints analíticos.
 * Dependências injetáveis para teste. Toda saída numérica termina com o rodapé de metadados.
 */
import { BR_STATES, INDICATORS } from '@h1n1/core';
import {
  getFreshness,
  getIndicators,
  getSeries,
  getSources,
  seriesCsvUrl,
  type ApiResult,
  type FreshnessRow,
  type IndicatorRow,
  type SeriesObservation,
  type SeriesParams,
  type SeriesResult,
  type SourceRow,
} from '@/lib/api';
import { getEars, getMapBrazil, getNowcast, type AnalyticsMeta, type EarsParams, type EarsResult, type MapBrazil, type NowcastResult } from './analytics';
import { block, dateBR, error, formatCell, formatNumber, metadataFooter, sparkline, table, text, warn, wrap, type CommandOutput, type OutputBlock } from './format';
import { helpLines, parseLine, type ParsedCommand } from './parser';

export interface ExecuteDeps {
  getSeries: (p: SeriesParams) => Promise<ApiResult<SeriesResult>>;
  getIndicators: () => Promise<ApiResult<{ data: IndicatorRow[] }>>;
  getFreshness: () => Promise<ApiResult<{ data: FreshnessRow[] }>>;
  getSources: (f: { priority?: string }) => Promise<ApiResult<{ data: SourceRow[] }>>;
  getNowcast: (indicator: string, geo: string) => Promise<ApiResult<NowcastResult>>;
  getEars: (p: EarsParams) => Promise<ApiResult<EarsResult>>;
  getMapBrazil: (indicator: string, opts?: { from?: string; to?: string }) => Promise<ApiResult<MapBrazil>>;
  seriesCsvUrl: (p: SeriesParams) => string;
}

function analyticsSource(meta: AnalyticsMeta, fallback: string): { name: string; url: null; license: string | null } {
  return { name: meta.source_id ? `fonte ${meta.source_id}` : fallback, url: null, license: meta.license };
}

export const defaultDeps: ExecuteDeps = { getSeries, getIndicators, getFreshness, getSources, getNowcast, getEars, getMapBrazil, seriesCsvUrl };

const DEFAULT_INDICATOR = 'sivep_srag_ah1n1pdm09_confirmed';
const MAX_SERIES_ROWS = 52;

export const EARS_NOTICE = 'sinal estatístico, não surto confirmado';

function geoLevelOf(geo: string): SeriesParams['geo_level'] {
  if (geo === 'WLD') return 'world';
  if (/^BR-(N|NE|SE|S|CO)$/.test(geo)) return 'region';
  if (/^BR-[A-Z]{2}$/.test(geo)) return 'state';
  return 'country';
}

function totalObs(r: SeriesResult): SeriesObservation[] {
  return r.observations.filter((o) => Object.keys(o.stratum).length === 0).sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}

function apiFailure(r: { status: 'unavailable' | 'not_found'; error: string }, what: string): OutputBlock {
  if (r.status === 'not_found') return error(`${what}: não encontrado.`, `detalhe: ${r.error}`);
  return error(`${what}: API indisponível no momento. Tente novamente mais tarde.`, `detalhe: ${r.error}`);
}

function ufName(code: string): string {
  const uf = code.replace(/^BR-/, '');
  return BR_STATES.find((s) => s.uf === uf)?.name ?? code;
}

// ---------- comandos ----------

async function cmdInd(args: ParsedCommand, deps: ExecuteDeps): Promise<CommandOutput> {
  const filter = (args.positional[0] ?? '').toLowerCase();
  const r = await deps.getIndicators();
  const sourceName = new Map<string, string>();
  let rows: Array<{ id: string; name: string; source_id: string }> = [];
  let origin = 'API /v1/indicators';
  if (r.ok) {
    rows = r.data.data.map((i) => ({ id: i.id, name: i.name, source_id: i.source_id }));
  } else {
    rows = INDICATORS.map((i) => ({ id: i.id, name: i.name, source_id: i.source_id }));
    origin = 'ontologia local (@h1n1/core); API indisponível';
  }
  if (filter) rows = rows.filter((i) => i.id.includes(filter) || i.name.toLowerCase().includes(filter));
  const srcs = await deps.getSources({});
  if (srcs.ok) for (const s of srcs.data.data) sourceName.set(s.id, s.name);
  const lines = table(
    ['id', 'nome', 'fonte'],
    rows.map((i) => [i.id, i.name, sourceName.get(i.source_id) ?? i.source_id]),
  );
  return {
    blocks: [
      text(`${rows.length} indicador(es) · origem: ${origin}`),
      block('table', lines),
      block('meta', ['use: series <id> [geo=BRA|BR-SP] [de=AAAA-Www] [ate=AAAA-Www]']),
    ],
  };
}

async function cmdSeries(args: ParsedCommand, deps: ExecuteDeps): Promise<CommandOutput> {
  const indicator = args.positional[0]!;
  const geo = args.named.geo ?? 'BRA';
  const params: SeriesParams = { indicator, geo_level: geoLevelOf(geo), geo_code: geo, from: args.named.de, to: args.named.ate };
  const r = await deps.getSeries(params);
  if (!r.ok) return { blocks: [apiFailure(r, `series ${indicator}`)] };
  const d = r.data;
  const obs = totalObs(d);
  const unit = d.indicator.unit;
  const header = text(`${d.indicator.name} · ${geo === 'BRA' ? 'Brasil' : /^BR-[A-Z]{2}$/.test(geo) ? ufName(geo) : geo} · ${obs.length} período(s)`);
  if (obs.length === 0) {
    return {
      blocks: [header, warn('Sem dados publicados para esta consulta (observations: []). Ausência não é zero.'), metadataFooter({ source: d.source, data_as_of: d.meta.data_as_of, universe_note: d.meta.universe_note, case_definition: d.meta.case_definition, suppression_threshold: d.meta.suppression_threshold })],
    };
  }
  const shown = obs.slice(-MAX_SERIES_ROWS);
  const provisional = shown.some((o) => o.update_status === 'provisional');
  const rows = shown.map((o) => [
    `${o.period}${o.update_status === 'provisional' ? '*' : ''}`,
    `${dateBR(o.period_start)}–${dateBR(o.period_end)}`,
    formatCell(o, d.meta.suppression_threshold, unit),
    o.quality_flags.length ? o.quality_flags.join('|') : '',
  ]);
  const spark = sparkline(shown.map((o) => (o.suppressed ? null : o.value)));
  const blocks: OutputBlock[] = [
    header,
    text(`${spark}  ${shown[0]!.period} → ${shown[shown.length - 1]!.period}${obs.length > shown.length ? ` (últimos ${shown.length} de ${obs.length})` : ''}`),
    block('table', table(['semana', 'intervalo', unit === 'percent' ? '%' : 'valor', 'flags'], rows, ['l', 'l', 'r', 'l'])),
  ];
  if ((d.meta as { truncated?: boolean }).truncated) blocks.push(warn('meta.truncated=true: o resultado pode estar incompleto; refine geo/período.'));
  blocks.push(
    metadataFooter({
      source: d.source,
      data_as_of: d.meta.data_as_of,
      universe_note: d.meta.universe_note,
      case_definition: d.meta.case_definition,
      suppression_threshold: d.meta.suppression_threshold,
      provisional,
    }),
  );
  return { blocks };
}

async function cmdTopUf(args: ParsedCommand, deps: ExecuteDeps): Promise<CommandOutput> {
  const indicator = args.positional[1]!;
  const week = args.positional[2];
  // 1) /v1/map/brazil (matriz UF × semana com supressão aplicada).
  const map = await deps.getMapBrazil(indicator, week ? { from: week, to: week } : {});
  if (map.ok && map.data.weeks.length) {
    const weeks = map.data.weeks;
    const idx = week ? weeks.indexOf(week) : weeks.length - 1;
    if (idx >= 0) {
      const rows = map.data.states.map((s) => ({ code: s.code, value: s.suppressed[idx] ? null : (s.values[idx] ?? null), suppressed: s.suppressed[idx] === true }));
      const m = map.data.meta;
      return rankingOutput(indicator, weeks[idx]!, rows, 5, analyticsSource(m, 'API /v1/map/brazil'), m.data_as_of, m.universe_note, m.case_definition);
    }
  }
  // 2) Fallback: séries estaduais via /v1/series.
  const r = await deps.getSeries({ indicator, geo_level: 'state', from: week, to: week });
  if (!r.ok) return { blocks: [apiFailure(r, `top uf ${indicator}`)] };
  const d = r.data;
  const obs = totalObs(d).filter((o) => o.geo_level === 'state');
  if (obs.length === 0) {
    return { blocks: [warn(`Sem recorte por UF publicado para ${indicator}${week ? ` em ${week}` : ''}. Indicadores FluNet só existem para o país.`), metadataFooter({ source: d.source, data_as_of: d.meta.data_as_of, universe_note: d.meta.universe_note })] };
  }
  const periods = [...new Set(obs.map((o) => o.period))].sort();
  const target = week ?? periods[periods.length - 1]!;
  const rows = obs.filter((o) => o.period === target).map((o) => ({ code: o.geo_code, value: o.suppressed ? null : o.value, suppressed: o.suppressed }));
  return rankingOutput(indicator, target, rows, d.meta.suppression_threshold, d.source, d.meta.data_as_of, d.meta.universe_note, d.meta.case_definition, d.indicator.unit);
}

function rankingOutput(
  indicator: string,
  period: string,
  rows: Array<{ code: string; value: number | null; suppressed: boolean }>,
  threshold: number,
  source: { name: string; url?: string | null; license?: string | null },
  data_as_of: string | null,
  universe_note: string | null,
  case_definition?: string,
  unit?: string,
): CommandOutput {
  const sorted = [...rows].sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
    return (b.value ?? -1) - (a.value ?? -1);
  });
  const lines = table(
    ['#', 'UF', 'nome', unit === 'percent' ? '%' : 'valor'],
    sorted.map((r, i) => [String(i + 1), r.code.replace(/^BR-/, ''), ufName(r.code), formatCell(r, threshold, unit)]),
    ['r', 'l', 'l', 'r'],
  );
  const suppressedCount = sorted.filter((r) => r.suppressed).length;
  const blocks: OutputBlock[] = [text(`top uf · ${indicator} · ${period} · ${rows.length} UF(s)`), block('table', lines)];
  if (suppressedCount) blocks.push(warn(`${suppressedCount} UF(s) com célula suprimida ("<${threshold || 5}"): o valor real não é publicado e não deve ser inferido.`));
  blocks.push(metadataFooter({ source, data_as_of, universe_note, case_definition, suppression_threshold: threshold }));
  return { blocks };
}

const num = (v: number | null, digits = 0): string => (v === null ? '—' : digits ? v.toFixed(digits) : formatNumber(v));

async function cmdNowcast(args: ParsedCommand, deps: ExecuteDeps): Promise<CommandOutput> {
  const indicator = args.positional[0] ?? DEFAULT_INDICATOR;
  const geo = args.positional[1] ?? 'BRA';
  const r = await deps.getNowcast(indicator, geo);
  if (!r.ok) {
    if (r.status === 'not_found') return { blocks: [warn(`nowcast indisponível para ${indicator} (${geo}).`), block('meta', ['sem publicação vigente da CDF de atraso (sivep_reporting_delay_cdf) para esta geo; use series para o dado observado.'])] };
    return { blocks: [apiFailure(r, 'nowcast')] };
  }
  const d = r.data;
  const rows = [...d.results].sort((a, b) => (a.period < b.period ? -1 : 1));
  const blocks: OutputBlock[] = [text(`nowcast · ${d.indicator.name} · ${geo}${d.delay ? ` · CDF de atraso ${d.delay.period} (n=${formatNumber(d.delay.n)})` : ''}`)];
  if (rows.length) {
    blocks.push(
      block(
        'table',
        table(
          ['semana', 'sem. atrás', 'observado', 'share rep.', 'estimado', 'IC inf', 'IC sup'],
          rows.map((x) => [x.period, String(x.weeks_ago), num(x.observed), x.reported_share === null ? '—' : `${(x.reported_share * 100).toFixed(0)}%`, num(x.estimated), num(x.lower, 1), num(x.upper, 1)]),
          ['l', 'r', 'r', 'r', 'r', 'r', 'r'],
        ),
      ),
    );
  } else blocks.push(warn('nowcast indisponível: resposta sem estimativas.'));
  blocks.push(warn(`aviso: ${d.note}`));
  blocks.push(metadataFooter({ source: analyticsSource(d.meta, 'API /v1/analytics/nowcast'), data_as_of: d.meta.data_as_of, universe_note: d.meta.universe_note, case_definition: d.meta.case_definition }));
  return { blocks };
}

async function cmdSinais(args: ParsedCommand, deps: ExecuteDeps): Promise<CommandOutput> {
  const indicator = args.positional[0] ?? DEFAULT_INDICATOR;
  const r = await deps.getEars({ indicator, geo_level: 'state' });
  if (!r.ok) {
    if (r.status === 'not_found') return { blocks: [warn(`sinais indisponíveis para ${indicator}: /v1/analytics/ears não publicou resultado.`), block('meta', [EARS_NOTICE])] };
    return { blocks: [apiFailure(r, 'sinais')] };
  }
  const d = r.data;
  const flagged = d.results.filter((x) => x.flags.length > 0);
  const shown = (flagged.length ? flagged : d.results).slice(0, 40);
  const thr = d.method.thresholds;
  const blocks: OutputBlock[] = [text(`sinais EARS · ${d.indicator.name} · ${d.method.name}${thr ? ` · limiares c1>${thr.c1} c2>${thr.c2} c3>${thr.c3}` : ''} · ${flagged.length} sinal(is) em ${d.results.length} geo-semana(s)`)];
  if (shown.length) {
    blocks.push(
      block(
        'table',
        table(
          ['geo', 'nome', 'semana', 'valor', 'c1', 'c2', 'c3', 'flags'],
          shown.map((x) => [x.geo_code.replace(/^BR-/, ''), x.name ?? ufName(x.geo_code), `${x.period}${x.provisional ? '*' : ''}`, x.value === null ? '<5/—' : formatNumber(x.value), num(x.c1, 2), num(x.c2, 2), num(x.c3, 2), x.flags.join(',')]),
          ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'l'],
        ),
      ),
    );
    if (!flagged.length) blocks.push(text('nenhum sinal estatístico no período avaliado.'));
  } else blocks.push(text('nenhuma geo-semana avaliada.'));
  blocks.push(warn(`aviso: ${d.method.note || EARS_NOTICE}. Um sinal indica valor acima do esperado pelo histórico recente; depende de atraso de notificação e cobertura. Valor "<5/—" = célula suprimida ou ausente.`));
  blocks.push(metadataFooter({ source: analyticsSource(d.meta, 'API /v1/analytics/ears'), data_as_of: d.meta.data_as_of, universe_note: d.meta.universe_note, case_definition: d.meta.case_definition, provisional: shown.some((x) => x.provisional) }));
  return { blocks };
}

async function cmdFontes(args: ParsedCommand, deps: ExecuteDeps): Promise<CommandOutput> {
  const priority = args.positional[0];
  const r = await deps.getSources({ priority });
  if (!r.ok) return { blocks: [apiFailure(r, 'fontes')] };
  const rows = r.data.data.map((s) => [s.priority, s.id, s.name, s.agency, s.access_type, s.update_cadence]);
  return {
    blocks: [
      text(`${rows.length} fonte(s)${priority ? ` com prioridade ${priority}` : ''}`),
      block('table', table(['prio', 'id', 'nome', 'órgão', 'acesso', 'cadência'], rows)),
      block('meta', ['detalhes e licenças em /dados/fontes/ · abrir /dados/fontes/']),
    ],
  };
}

async function cmdStatus(deps: ExecuteDeps): Promise<CommandOutput> {
  const r = await deps.getFreshness();
  if (!r.ok) return { blocks: [apiFailure(r, 'status')] };
  const rows = r.data.data.map((f) => [
    f.indicator_id,
    f.source_id,
    dateBR(f.data_as_of),
    f.age_days === null ? '—' : String(f.age_days),
    f.age_days !== null && f.age_days > 14 ? 'DEFASADO' : f.data_as_of ? 'ok' : 'sem publicação',
  ]);
  return {
    blocks: [
      text(`frescor de ${rows.length} indicador(es) · gerado em ${dateBR(new Date().toISOString())}`),
      block('table', table(['indicador', 'fonte', 'base de', 'idade (dias)', 'estado'], rows, ['l', 'l', 'l', 'r', 'l'])),
      block('meta', ['idade = dias desde a última ingestão da snapshot vigente; "DEFASADO" acima de 14 dias. Este painel não é "tempo real".']),
    ],
  };
}

async function cmdCsv(args: ParsedCommand, deps: ExecuteDeps): Promise<CommandOutput> {
  const indicator = args.positional[0]!;
  const geo = args.positional[1] ?? 'BRA';
  const url = deps.seriesCsvUrl({ indicator, geo_level: geoLevelOf(geo), geo_code: geo });
  return {
    blocks: [text(`abrindo CSV: ${url}`), block('meta', ['o CSV traz source_id, data_as_of e license por linha; acompanhe com o dicionário em /dados/metodologia/.'])],
    action: { type: 'open', url },
  };
}

/** Comandos que não precisam da API (resolvidos no cliente ou no servidor). */
export function executeLocal(cmd: ParsedCommand): CommandOutput | null {
  switch (cmd.name) {
    case 'help':
      return { blocks: [text(...helpLines(cmd.positional[0]))] };
    case 'clear':
      return { blocks: [], action: { type: 'clear' } };
    case 'abrir':
      return { blocks: [text(`abrindo ${cmd.positional[0]}`)], action: { type: 'navigate', href: cmd.positional[0]! } };
    default:
      return null;
  }
}

export async function executeParsed(cmd: ParsedCommand, deps: ExecuteDeps = defaultDeps): Promise<CommandOutput> {
  const local = executeLocal(cmd);
  if (local) return local;
  switch (cmd.name) {
    case 'ind':
      return cmdInd(cmd, deps);
    case 'series':
      return cmdSeries(cmd, deps);
    case 'top':
      return cmdTopUf(cmd, deps);
    case 'nowcast':
      return cmdNowcast(cmd, deps);
    case 'sinais':
      return cmdSinais(cmd, deps);
    case 'fontes':
      return cmdFontes(cmd, deps);
    case 'status':
      return cmdStatus(deps);
    case 'csv':
      return cmdCsv(cmd, deps);
    default:
      return { blocks: [error(`Comando '${cmd.name}' sem executor.`)] };
  }
}

/** Interpreta e executa uma linha. Nunca lança. */
export async function executeLine(line: string, deps: ExecuteDeps = defaultDeps): Promise<CommandOutput> {
  const parsed = parseLine(line);
  if (!parsed.ok) return { blocks: [error(parsed.error)] };
  try {
    return await executeParsed(parsed.command, deps);
  } catch (err) {
    return { blocks: [error('Falha inesperada ao executar o comando.', `detalhe: ${err instanceof Error ? err.message : String(err)}`)] };
  }
}

/** Linhas de universo quebradas para exibição (helper de UI). */
export function wrapMeta(lines: string[], width = 100): string[] {
  return lines.flatMap((l) => wrap(l, width));
}
