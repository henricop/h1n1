import { describe, expect, it } from 'vitest';
import { applyCompletion, COMMANDS, completions, helpLines, parseLine, tokenize } from '@/lib/terminal/parser';
import { formatCell, metadataFooter, sparkline, table } from '@/lib/terminal/format';
import { buildPaletteGroups, currentCsvUrl, paletteIndicators } from '@/lib/terminal/palette-items';
import { defaultDeps, EARS_NOTICE, executeLine, executeLocal, type ExecuteDeps } from '@/lib/terminal/execute';
import { OBSERVATORY_INDICATORS } from '@/lib/observatory';
import type { ApiResult } from '@/lib/api';
import type { EarsResult, MapBrazil, NowcastResult } from '@/lib/terminal/analytics';

describe('parser: tokens e argumentos', () => {
  it('tokeniza respeitando aspas', () => {
    expect(tokenize('series  x geo=BRA')).toEqual(['series', 'x', 'geo=BRA']);
    expect(tokenize('abrir "/dados/brasil/" \'a b\'')).toEqual(['abrir', '/dados/brasil/', 'a b']);
  });

  it('separa posicionais de nomeados e normaliza', () => {
    const r = parseLine('series sivep_srag_ah1n1pdm09_confirmed geo=br-sp de=2026-w01 ate=2026-W10');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.command.name).toBe('series');
    expect(r.command.positional).toEqual(['sivep_srag_ah1n1pdm09_confirmed']);
    expect(r.command.named).toEqual({ geo: 'BR-SP', de: '2026-W01', ate: '2026-W10' });
  });

  it('reconhece subcomando e semana de top uf', () => {
    const r = parseLine('top UF sivep_srag_notifications 2026-w40');
    expect(r.ok && r.command.positional).toEqual(['uf', 'sivep_srag_notifications', '2026-W40']);
  });

  it('erros amigáveis: vazio, desconhecido, argumento faltando, nomeado inválido', () => {
    expect(parseLine('')).toMatchObject({ ok: false, error: expect.stringMatching(/help/) });
    const unknown = parseLine('serie x');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toMatch(/desconhecido 'serie'.*series/);
    expect(parseLine('series')).toMatchObject({ ok: false, error: expect.stringMatching(/<indicador>/) });
    expect(parseLine('series x geo=SP')).toMatchObject({ ok: false, error: expect.stringMatching(/geo inválido/) });
    expect(parseLine('series x de=2026-13')).toMatchObject({ ok: false, error: expect.stringMatching(/de inválido/) });
    expect(parseLine('series x de=2026-W10 ate=2026-W01')).toMatchObject({ ok: false, error: expect.stringMatching(/posterior/) });
    expect(parseLine('series x foo=1')).toMatchObject({ ok: false, error: expect.stringMatching(/desconhecido 'foo'/) });
    expect(parseLine('status x=1')).toMatchObject({ ok: false, error: expect.stringMatching(/não aceita/) });
    expect(parseLine('top estado x')).toMatchObject({ ok: false });
    expect(parseLine('fontes P9')).toMatchObject({ ok: false, error: expect.stringMatching(/P0, P1 ou P2/) });
    expect(parseLine('abrir http://evil')).toMatchObject({ ok: false, error: expect.stringMatching(/Rota inválida/) });
    expect(parseLine('series Indicador-Ruim')).toMatchObject({ ok: false, error: expect.stringMatching(/Indicador inválido/) });
  });

  it('help lista todos os comandos; completions por prefixo e por indicador', () => {
    const lines = helpLines();
    for (const c of COMMANDS) expect(lines.join('\n')).toContain(c.usage);
    expect(completions('se')).toEqual(['series']);
    expect(completions('series sivep_srag_ah1', ['sivep_srag_ah1n1pdm09_confirmed', 'sivep_srag_notifications'])).toEqual(['sivep_srag_ah1n1pdm09_confirmed']);
    expect(completions('top ', [])).toEqual(['uf']);
    expect(applyCompletion('se', ['series'])).toBe('series ');
    expect(applyCompletion('series sivep', ['sivep_srag_a', 'sivep_srag_b'])).toBe('series sivep_srag_');
  });
});

describe('formatação', () => {
  it('célula suprimida nunca revela o valor', () => {
    expect(formatCell({ value: 3, suppressed: true }, 5)).toBe('<5');
    expect(formatCell({ value: 3, suppressed: true }, 0)).toBe('<5');
    expect(formatCell({ value: null, suppressed: false })).toBe('—');
    expect(formatCell({ value: 1234, suppressed: false })).toBe('1.234');
    expect(formatCell({ value: 12.34, suppressed: false }, 0, 'percent')).toBe('12,3%');
  });

  it('sparkline ignora nulos e não os coloca na escala', () => {
    const s = sparkline([1, null, 8]);
    expect(s).toHaveLength(3);
    expect(s[1]).toBe('·');
    expect(s[0]).toBe('▁');
    expect(s[2]).toBe('█');
    expect(sparkline([null, null])).toBe('··');
    expect(sparkline([5, 5])).toBe('▄▄');
  });

  it('tabela alinha colunas e rodapé traz fonte, base e universo', () => {
    const t = table(['a', 'valor'], [['x', '1'], ['yy', '100']], ['l', 'r']);
    expect(t[0]).toBe('a   valor');
    expect(t[2]).toBe('x       1');
    expect(t[3]).toBe('yy    100');
    const m = metadataFooter({ source: { name: 'SIVEP', license: 'CC-BY' }, data_as_of: '2026-10-13', universe_note: 'Universo X.', suppression_threshold: 5 });
    expect(m.kind).toBe('meta');
    expect(m.lines.join('\n')).toMatch(/fonte: SIVEP · licença: CC-BY/);
    expect(m.lines.join('\n')).toMatch(/base de: 13\/10\/2026/);
    expect(m.lines.join('\n')).toMatch(/universo: Universo X\./);
    expect(m.lines.join('\n')).toMatch(/"<5"/);
  });
});

describe('paleta', () => {
  it('lista todos os indicadores do observatório com navegação para /dados/brasil/', () => {
    const items = paletteIndicators();
    expect(items).toHaveLength(OBSERVATORY_INDICATORS.length);
    const first = items.find((i) => i.id === 'ind:sivep_srag_ah1n1pdm09_confirmed');
    expect(first?.action).toEqual({ type: 'navigate', href: '/dados/brasil/?indicador=sivep_srag_ah1n1pdm09_confirmed' });
    expect(first?.hint).toContain('BR-03');
  });

  it('grupos: páginas (rotas de app + conteúdo), indicadores e comandos; CSV do indicador atual', () => {
    const groups = buildPaletteGroups([{ label: 'O que é H1N1?', href: '/o-que-e-h1n1/' }], '?indicador=sivep_srag_notifications&uf=sp');
    expect(groups.map((g) => g.heading)).toEqual(['Páginas', 'Indicadores', 'Comandos']);
    const pages = groups[0]!.items.map((i) => i.action.type === 'navigate' && i.action.href);
    expect(pages).toEqual(expect.arrayContaining(['/dados/brasil/', '/dados/mundo/', '/terminal/', '/o-que-e-h1n1/']));
    const csv = groups[2]!.items.find((i) => i.id === 'cmd:csv')!;
    expect(csv.action.type === 'open' && csv.action.url).toMatch(/\/v1\/series\.csv\?indicator=sivep_srag_notifications&geo_level=state&geo_code=BR-SP$/);
    expect(currentCsvUrl('')).toMatch(/indicator=sivep_srag_ah1n1pdm09_confirmed&geo_level=country&geo_code=BRA$/);
    expect(currentCsvUrl('?indicador=flunet_ah1n1pdm09_detections&uf=SP')).toMatch(/geo_code=BRA$/);
  });
});

describe('executor (modo mock da API)', () => {
  it('comandos locais: help, clear, abrir', () => {
    expect(executeLocal({ name: 'clear', positional: [], named: {}, raw: 'clear' })?.action).toEqual({ type: 'clear' });
    expect(executeLocal({ name: 'abrir', positional: ['/terminal/'], named: {}, raw: '' })?.action).toEqual({ type: 'navigate', href: '/terminal/' });
    expect(executeLocal({ name: 'help', positional: [], named: {}, raw: 'help' })?.blocks[0]?.lines.join('\n')).toContain('series <indicador>');
  });

  it('series: tabela, sparkline e rodapé obrigatório (fonte, base, universo)', async () => {
    const out = await executeLine('series sivep_srag_ah1n1pdm09_confirmed de=2026-W30 ate=2026-W41');
    const kinds = out.blocks.map((b) => b.kind);
    expect(kinds).toContain('table');
    expect(out.blocks[out.blocks.length - 1]?.kind).toBe('meta');
    const meta = out.blocks[out.blocks.length - 1]!.lines.join('\n');
    expect(meta).toMatch(/fonte: /);
    expect(meta).toMatch(/base de: \d{2}\/\d{2}\/\d{4}/);
    expect(meta).toMatch(/universo: .*não todos os casos de H1N1/);
    const spark = out.blocks[1]!.lines[0]!;
    expect(spark).toMatch(/^[▁▂▃▄▅▆▇█·]+ {2}2026-W30 → 2026-W41/);
  });

  it('series por UF: células suprimidas aparecem como "<5" e nunca com valor', async () => {
    const out = await executeLine('series sivep_srag_ah1n1pdm09_confirmed geo=BR-AC');
    const tbl = out.blocks.find((b) => b.kind === 'table');
    expect(tbl).toBeDefined();
    const text = tbl!.lines.join('\n');
    expect(text).toMatch(/<5/);
  });

  it('top uf usa séries estaduais quando /v1/map/brazil está indisponível e ordena suprimidos ao fim', async () => {
    const out = await executeLine('top uf sivep_srag_ah1n1pdm09_confirmed');
    const tbl = out.blocks.find((b) => b.kind === 'table')!;
    expect(tbl.lines.length).toBeGreaterThan(5);
    const rows = tbl.lines.slice(2);
    const firstSuppressed = rows.findIndex((r) => /<5$/.test(r));
    if (firstSuppressed >= 0) expect(rows.slice(firstSuppressed).every((r) => /<5$/.test(r))).toBe(true);
    expect(out.blocks[out.blocks.length - 1]!.lines.join('\n')).toMatch(/universo: /);
  });

  it('nowcast e sinais: 404 vira "indisponível" com o aviso EARS', async () => {
    const n = await executeLine('nowcast');
    expect(n.blocks[0]?.kind).toBe('warn');
    expect(n.blocks[0]?.lines[0]).toMatch(/nowcast indisponível/);
    const s = await executeLine('sinais');
    expect(s.blocks.map((b) => b.lines.join('\n')).join('\n')).toContain(EARS_NOTICE);
  });

  it('status, fontes, ind e csv', async () => {
    const st = await executeLine('status');
    expect(st.blocks.find((b) => b.kind === 'table')?.lines[0]).toMatch(/indicador/);
    const f = await executeLine('fontes P0');
    expect(f.blocks[0]?.lines[0]).toMatch(/fonte\(s\) com prioridade P0/);
    const ind = await executeLine('ind h1n1');
    expect(ind.blocks.find((b) => b.kind === 'table')?.lines.join('\n')).toContain('sivep_srag_ah1n1pdm09_confirmed');
    const csv = await executeLine('csv sivep_srag_ah1n1pdm09_confirmed BR-SP');
    expect(csv.action).toMatchObject({ type: 'open', url: expect.stringMatching(/\/v1\/series\.csv\?indicator=sivep_srag_ah1n1pdm09_confirmed&geo_level=state&geo_code=BR-SP/) });
  });

  it('erro de parse vira bloco de erro, nunca exceção', async () => {
    const out = await executeLine('series');
    expect(out.blocks[0]?.kind).toBe('error');
  });
});

describe('executor com endpoints analíticos simulados', () => {
  const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data, fetchedAt: 'now' });
  const meta = { data_as_of: '2026-10-19', universe_note: 'Universo SRAG.', license: 'CC-BY', source_id: 'BR-03', case_definition: 'X', caveats: [] };

  it('top uf via /v1/map/brazil: suprimido vira "<5" mesmo se a API mandar valor', async () => {
    const map: MapBrazil = {
      indicator: { id: 'sivep_srag_ah1n1pdm09_confirmed', name: 'SRAG H1N1' },
      meta,
      weeks: ['2026-W40', '2026-W41'],
      states: [
        { code: 'BR-SP', uf: 'SP', name: 'São Paulo', values: [10, 37], suppressed: [false, false] },
        { code: 'BR-AC', uf: 'AC', name: 'Acre', values: [null, 3], suppressed: [true, true] },
      ],
    };
    const deps: ExecuteDeps = { ...defaultDeps, getMapBrazil: async () => ok(map) };
    const out = await executeLine('top uf sivep_srag_ah1n1pdm09_confirmed', deps);
    const tbl = out.blocks.find((b) => b.kind === 'table')!.lines.join('\n');
    expect(tbl).toMatch(/SP\s+São Paulo\s+37/);
    expect(tbl).toMatch(/AC\s+Acre\s+<5/);
    expect(tbl).not.toMatch(/\b3\b/);
    expect(out.blocks[0]!.lines[0]).toContain('2026-W41');
    expect(out.blocks[out.blocks.length - 1]!.lines.join('\n')).toMatch(/base de: 19\/10\/2026/);
  });

  it('sinais: tabela com flags e aviso obrigatório', async () => {
    const ears: EarsResult = {
      indicator: { id: 'sivep_srag_ah1n1pdm09_confirmed', name: 'SRAG H1N1' },
      meta,
      method: { name: 'EARS C1/C2/C3', baseline: 8, guard: 2, thresholds: { c1: 3, c2: 3, c3: 2 }, note: 'sinal estatístico, não surto confirmado; semanas provisórias subestimam' },
      results: [
        { geo_code: 'BR-SP', name: 'São Paulo', period: '2026-W40', value: 61, provisional: true, c1: 4.21, c2: 5.07, c3: 6.9, flags: ['C1', 'C2', 'C3'] },
        { geo_code: 'BR-AC', name: 'Acre', period: '2026-W40', value: null, provisional: true, c1: null, c2: null, c3: null, flags: [] },
      ],
    };
    const deps: ExecuteDeps = { ...defaultDeps, getEars: async () => ok(ears) };
    const out = await executeLine('sinais', deps);
    const all = out.blocks.map((b) => b.lines.join('\n')).join('\n');
    expect(all).toMatch(/SP\s+São Paulo\s+2026-W40\*\s+61\s+4\.21\s+5\.07\s+6\.90\s+C1,C2,C3/);
    expect(all).toContain(EARS_NOTICE);
    expect(all).toMatch(/1 sinal\(is\) em 2 geo-semana/);
  });

  it('nowcast: tabela de estimativas com nota de que é estimativa', async () => {
    const nc: NowcastResult = {
      indicator: { id: 'sivep_srag_ah1n1pdm09_confirmed', name: 'SRAG H1N1' },
      meta,
      delay: { period: '2026', n: 4210, cdf: [21.3, 48.9], source_indicator: 'sivep_reporting_delay_cdf' },
      results: [{ period: '2026-W41', weeks_ago: 1, observed: 44, reported_share: 0.489, estimated: 90, lower: 87.3, upper: 92.8 }],
      note: 'Estimativa, não contagem.',
    };
    const deps: ExecuteDeps = { ...defaultDeps, getNowcast: async () => ok(nc) };
    const out = await executeLine('nowcast sivep_srag_ah1n1pdm09_confirmed BR-SP', deps);
    const all = out.blocks.map((b) => b.lines.join('\n')).join('\n');
    expect(all).toMatch(/2026-W41\s+1\s+44\s+49%\s+90\s+87\.3\s+92\.8/);
    expect(all).toContain('Estimativa, não contagem.');
    expect(all).toMatch(/universo: Universo SRAG\./);
  });
});
