import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// O pôster do globo é um componente de servidor assíncrono (lê public/geo com fs); renderToStaticMarkup não o resolve.
vi.mock('@/components/sala/GlobePoster', () => ({ GlobePoster: () => createElement('figure', { 'data-poster': 'true' }, 'pôster do globo') }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('endpoints novos (zod + mock)', () => {
  it('/v1/globe: fixture válida, semanas ISO contínuas e filtro from', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const api = await import('@/lib/api');
    const g = await api.getGlobe({ indicator: 'flunet_ah1n1pdm09_detections', from: '2009-W01' });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.data.weeks[0]).toBe('2009-W01');
    expect(g.data.weeks.length).toBeGreaterThan(900);
    expect(g.data.countries.every((c) => c.values.length === g.data.weeks.length)).toBe(true);
    expect(g.data.countries.some((c) => c.iso3 === 'BRA')).toBe(true);
    expect(g.data.meta.universe_note).toMatch(/não todos os casos/);
    const recent = await api.getGlobe({ indicator: 'flunet_ah1n1pdm09_detections', from: '2026-W01' });
    expect(recent.ok && recent.data.weeks[0]).toBe('2026-W01');
    expect(recent.ok && recent.data.countries[0]!.values.length).toBe(recent.ok ? recent.data.weeks.length : -1);
  });

  it('/v1/map/brazil: 27 UFs, célula suprimida nunca carrega valor, filtro from/to', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const api = await import('@/lib/api');
    const m = await api.getBrazilMap({ indicator: 'sivep_srag_ah1n1pdm09_deaths' });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.data.states.length).toBe(27);
    expect(m.data.states.some((s) => s.suppressed.some(Boolean))).toBe(true);
    for (const s of m.data.states) s.suppressed.forEach((sup, i) => sup && expect(s.values[i]).toBeNull());
    expect(m.data.national.values.length).toBe(m.data.weeks.length);
    const slice = await api.getBrazilMap({ indicator: 'sivep_srag_ah1n1pdm09_deaths', from: '2026-W30', to: '2026-W33' });
    expect(slice.ok && slice.data.weeks).toEqual(['2026-W30', '2026-W31', '2026-W32', '2026-W33']);
    expect(slice.ok && slice.data.states[0]!.values.length).toBe(4);
    // normalização também vale para a API real que "vaza" valor suprimido
    expect(api.normalizeMapState({ code: 'BR-SP', uf: 'SP', name: 'São Paulo', ibge: '35', values: [3, 10], suppressed: [true, false] }).values).toEqual([null, 10]);
  });

  it('/v1/analytics/ears, seasons, runs e latest validam e respeitam parâmetros', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const api = await import('@/lib/api');
    const e = await api.getEars({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_level: 'state', weeks: 12 });
    expect(e.ok && e.data.results.length).toBe(27);
    expect(e.ok && e.data.method.note).toMatch(/não surto confirmado/);
    const s = await api.getSeasons({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_code: 'BRA', from_year: 2024 });
    expect(s.ok && s.data.seasons.map((x) => x.year)).toEqual([2024, 2025, 2026]);
    expect(s.ok && s.data.weeks.length).toBe(53);
    const r = await api.getRuns(3);
    expect(r.ok && r.data.data.length).toBe(3);
    expect(r.ok && r.data.data.some((x) => x.status === 'failed' && x.error)).toBe(false);
    const all = await api.getRuns(30);
    expect(all.ok && all.data.data.some((x) => x.status === 'failed' && x.error)).toBe(true);
    const l = await api.getLatest('sivep_srag_ah1n1pdm09_confirmed', 'BRA');
    expect(l.ok && l.data.period).toMatch(/^\d{4}-W\d{2}$/);
    expect(l.ok && typeof l.data.provisional).toBe('boolean');
    const bad = await api.getLatest('x; drop', 'BRA');
    expect(bad.ok).toBe(false);
  });

  it('/v1/analytics/nowcast: fixture válida; 404 nowcast_unavailable vira not_found sem lançar', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const api = await import('@/lib/api');
    const n = await api.getNowcast({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_code: 'BRA' });
    expect(n.ok).toBe(true);
    if (n.ok) {
      expect(n.data.delay.cdf.length).toBe(13);
      expect(n.data.results.every((r) => r.lower <= r.estimated && r.estimated <= r.upper)).toBe(true);
      expect(n.data.note).toMatch(/ainda não digitadas/);
    }
    const missing = await api.getNowcast({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_code: 'BR-SP' });
    expect(!missing.ok && missing.status).toBe('not_found');
    vi.resetModules();
    vi.stubEnv('H1N1_API_MOCK', '0');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'nowcast_unavailable' }, { status: 404 })));
    const api2 = await import('@/lib/api');
    const r = await api2.getNowcast({ indicator: 'sivep_srag_ah1n1pdm09_confirmed' });
    expect(!r.ok && r.status).toBe('not_found');
  });

  it('contrato inválido do globo (país sem lat/lon) vira unavailable com motivo logado', async () => {
    vi.stubEnv('H1N1_API_MOCK', '0');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ indicator: { id: 'x', name: 'x' }, meta: { data_as_of: null, universe_note: '', license: null, source_id: 'INT-01', case_definition: '' }, weeks: ['2026-W01'], countries: [{ iso3: 'BRA', name: 'Brasil', values: [1] }] })));
    const api = await import('@/lib/api');
    const g = await api.getGlobe({ indicator: 'flunet_ah1n1pdm09_detections' });
    expect(!g.ok && g.status).toBe('unavailable');
    expect(!g.ok && g.error).toMatch(/Contrato inválido/);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('linha do tempo (scrubber)', () => {
  it('weekRange respeita anos ISO com 53 semanas e alignWeeks preenche nulos', async () => {
    const t = await import('@/lib/timeline');
    expect(t.isoWeeksInYear(2009)).toBe(53);
    expect(t.isoWeeksInYear(2010)).toBe(52);
    expect(t.isoWeeksInYear(2015)).toBe(53);
    expect(t.isoWeeksInYear(2020)).toBe(53);
    const r = t.weekRange('2009-W52', '2010-W02');
    expect(r).toEqual(['2009-W52', '2009-W53', '2010-W01', '2010-W02']);
    expect(t.weekRange('2010-W05', '2010-W01')).toEqual([]);
    expect(t.weekRange('abc', '2010-W01')).toEqual([]);
    const axis = t.weekRange('2026-W01', '2026-W05');
    expect(t.alignWeeks(axis, ['2026-W02', '2026-W04', '2027-W01'], [10, 20, 30])).toEqual([null, 10, null, 20, null]);
    expect(t.nearestIndex(axis, '2026-W03')).toBe(2);
    expect(t.nearestIndex(axis, '2025-W50')).toBe(0);
    expect(t.nearestIndex(axis, '2030-W01')).toBe(4);
    expect(t.coverage(axis, '2026-W03')).toMatchObject({ covered: true, shown: '2026-W03' });
    expect(t.coverage(axis, '2009-W17')).toMatchObject({ covered: false, shown: '2026-W01' });
    expect(t.coverage(axis, '2030-W01')).toMatchObject({ covered: false, shown: '2026-W05' });
    expect(t.weekLabel('2009-W17')).toBe('SEMANA ISO 17 · 2009');
    expect(t.PANDEMIC_REPLAY).toEqual({ from: '2009-W17', to: '2010-W33' });
    // janela do globo enviada no RSC (achado m): constante em módulo de servidor (um módulo 'use client' viraria referência → NaN)
    expect(t.GLOBE_WINDOW_WEEKS).toBe(160);
    const fullAxis = t.weekRange('2009-W01', '2026-W40');
    const offset = Math.max(0, fullAxis.length - t.GLOBE_WINDOW_WEEKS);
    expect(Number.isFinite(offset) && offset > 700).toBe(true);
  });
});

describe('escala do mapa e contadores da semana', () => {
  it('mapCell: suprimido = hachura, sem dado = pontilhado (desenhos distintos), zero = cor própria, escala por raiz quadrada', async () => {
    const m = await import('@/lib/map-scale');
    expect(m.mapCell(null, false, 100).kind).toBe('nodata');
    expect(m.mapCell(null, false, 100).fill).toBe(m.MAP_COLOR_NODATA);
    expect(m.mapCell(50, true, 100).kind).toBe('suppressed');
    expect(m.mapCell(50, true, 100).fill).toBe(m.MAP_COLOR_SUPPRESSED);
    expect(m.MAP_COLOR_SUPPRESSED).not.toBe(m.MAP_COLOR_NODATA);
    expect(m.mapCell(0, false, 100).kind).toBe('zero');
    const c = m.mapCell(25, false, 100);
    expect(c.kind).toBe('value');
    if (c.kind === 'value') expect(c.t).toBeCloseTo(0.5);
    expect(m.mapCell(100, false, 100).fill.toLowerCase()).toBe(m.MAP_COLOR_HIGH.toLowerCase());
    expect(m.mapCell(1, false, 0).kind).toBe('value');
    expect(m.maxPublished([5, null, 9, 100], [false, false, false, true])).toBe(9);
    expect(m.sqrtRadius(null, 100, 10)).toBe(0);
    expect(m.sqrtRadius(25, 100, 10)).toBeCloseTo(5);
    expect(m.legendStops(100).at(-1)?.value).toBe(100);
    expect(m.mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('legendStops é gerada dos dados: inteiros crescentes, sem repetir valores nem "0" quando o máximo é pequeno', async () => {
    const { legendStops } = await import('@/lib/map-scale');
    const small = legendStops(3).map((s) => s.value);
    expect(small).toEqual([...new Set(small)]);
    expect(small.every((v) => Number.isInteger(v) && v >= 1)).toBe(true);
    expect(small.at(-1)).toBe(3);
    expect(legendStops(0)).toEqual([]);
    const big = legendStops(1000).map((s) => s.value);
    expect(big).toEqual([...big].sort((a, b) => a - b));
  });

  it('textOn escolhe tinta ou branco pelo maior contraste sobre a cor da UF', async () => {
    const { textOn, MAP_COLOR_HIGH, MAP_COLOR_LOW } = await import('@/lib/map-scale');
    expect(textOn(MAP_COLOR_HIGH)).toBe('#ffffff');
    expect(textOn(MAP_COLOR_LOW)).toBe('#14130f');
  });

  it('hudForWeek soma só valores publicados, conta países e posiciona o Brasil', async () => {
    const { hudForWeek, globalMax } = await import('@/lib/hud');
    const countries = [
      { iso3: 'USA', name: 'EUA', lat: 0, lon: 0, who_region: 'AMR', values: [100, null] },
      { iso3: 'BRA', name: 'Brasil', lat: 0, lon: 0, who_region: 'AMR', values: [40, 0] },
      { iso3: 'ARG', name: 'Argentina', lat: 0, lon: 0, who_region: 'AMR', values: [60, 5] },
      { iso3: 'CHL', name: 'Chile', lat: 0, lon: 0, who_region: 'AMR', values: [null, null] },
    ];
    const w0 = hudForWeek(countries, 0);
    expect(w0).toMatchObject({ worldTotal: 200, countriesReporting: 3, brazil: 40, brazilRank: 3 });
    expect(w0.ranking.map((r) => r.iso3)).toEqual(['USA', 'ARG', 'BRA']);
    const w1 = hudForWeek(countries, 1);
    expect(w1).toMatchObject({ worldTotal: 5, countriesReporting: 2, brazil: 0, brazilRank: null });
    expect(globalMax(countries)).toBe(100);
  });

  it('weekTitle mostra a semana em caixa normal (caixa alta só em Big Shoulders)', async () => {
    const { weekTitle } = await import('@/lib/hud');
    expect(weekTitle('2009-W17')).toBe('Semana ISO 17 · 2009');
    expect(weekTitle('abc')).toBe('abc');
  });
});

describe('componentes da sala (SSR)', () => {
  it('EarsTable rotula "sinal estatístico, não surto confirmado" e mostra "<5" na célula suprimida', async () => {
    const { EarsTable } = await import('@/components/sala/EarsTable');
    const ears = {
      ok: true as const,
      fetchedAt: '2026-10-20T00:00:00Z',
      data: {
        indicator: { id: 'x', name: 'X' },
        meta: { data_as_of: '2026-10-13', universe_note: 'u', license: 'CC-BY', source_id: 'BR-03', case_definition: 'c' },
        method: { name: 'EARS', baseline: '7', guard: '2', thresholds: 'C2 > 3', note: 'Sinal estatístico, não surto confirmado.' },
        results: [
          { geo_code: 'BR-SP', name: 'São Paulo', period: '2026-W37', value: 16, provisional: false, c1: 1, c2: 3.9, c3: 2.6, flags: ['C2'] },
          { geo_code: 'BR-AC', name: 'Acre', period: '2026-W37', value: null, provisional: false, c1: null, c2: null, c3: null, flags: ['suppressed'] },
        ],
      },
    };
    const html = renderToStaticMarkup(createElement(EarsTable, { ears, threshold: 5 }));
    expect(html).toContain('não surto confirmado');
    expect(html).toContain('&lt;5');
    expect(html).toContain('1 UF com sinal');
    expect(html).toContain('u'); // meta.universe_note exibido (achado h)
    const withNote = renderToStaticMarkup(createElement(EarsTable, { ears: { ...ears, data: { ...ears.data, meta: { ...ears.data.meta, universe_note: 'Universo EARS de teste.' } } }, threshold: 5 }));
    expect(withNote).toContain('Universo EARS de teste.');
  });

  it('IngestConsole renderiza todas as linhas no SSR (animação só CSS) e sem efeitos de terminal', async () => {
    const { IngestConsole } = await import('@/components/sala/IngestConsole');
    const runs = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, connector: `con_${i}`, source_id: 'BR-03', started_at: '2026-10-20T09:00:00Z', finished_at: '2026-10-20T09:01:00Z', status: i === 3 ? 'failed' : 'ok', rows_in: 10, rows_out: 9, error: i === 3 ? 'timeout' : null }));
    const html = renderToStaticMarkup(createElement(IngestConsole, { runs: { ok: true as const, fetchedAt: 'x', data: { data: runs } } }));
    expect((html.match(/console-line/g) ?? []).length).toBe(12);
    expect(html).toContain('con_11');
    expect(html).toContain('--delay');
    expect(html).not.toMatch(/scanlines|cursor-blink|hud-/);
  });

  it('LatestChip não exibe tendência quando a célula está suprimida (achado g)', async () => {
    const { LatestChip } = await import('@/components/sala/LatestChip');
    const fresh = { ok: true as const, fetchedAt: 'x', data: { data: [] } };
    const base = { indicator: { id: 'sivep_srag_ah1n1pdm09_confirmed', name: 'X' }, geo_code: 'BRA', period: '2026-W40', period_end: '2026-10-03', provisional: false, trend_pct_vs_4w: 42, data_as_of: '2026-10-13' };
    const sup = renderToStaticMarkup(createElement(LatestChip, { latest: { ok: true as const, fetchedAt: 'x', data: { ...base, value: null, suppressed: true } }, fresh }));
    expect(sup).toContain('&lt;5');
    expect(sup).not.toContain('vs 4 sem');
    const ok = renderToStaticMarkup(createElement(LatestChip, { latest: { ok: true as const, fetchedAt: 'x', data: { ...base, value: 120, suppressed: false } }, fresh }));
    expect(ok).toContain('42% vs 4 sem');
  });

  it('CompositionChart só marca provisório quando provisionalFrom >= 0 (achado f); escapeHtml do rótulo do globo (achado e)', async () => {
    const { CompositionChart } = await import('@/components/sala/CompositionChart');
    const weeks = ['2026-W40', '2026-W41'];
    const layers = [{ id: 'a', name: 'A(H1N1)pdm09', color: '#d6007f', values: [1, 2] }];
    const none = renderToStaticMarkup(createElement(CompositionChart, { weeks, layers, positivity: null, provisionalFrom: -1, tableId: 't' }));
    expect(none).not.toContain('provisória');
    expect((none.match(/consolidada/g) ?? []).length).toBe(2);
    const some = renderToStaticMarkup(createElement(CompositionChart, { weeks, layers, positivity: null, provisionalFrom: 1, tableId: 't' }));
    expect((some.match(/provisória/g) ?? []).length).toBe(1);
    const { escapeHtml } = await import('@/lib/html');
    expect(escapeHtml('<img src=x onerror=alert(1)> & "Brasil"')).toBe('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Brasil&quot;');
  });

  it('CSP do next.config só permite o próprio site e a API própria; sem iframe; unsafe-eval e ws: só em dev', async () => {
    const { buildCsp } = await import('../next.config');
    const prod = buildCsp('https://api.example.test', false);
    const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `));
    expect(prod).toMatch(/default-src 'self'/);
    expect(directive(prod, 'connect-src')).toBe("connect-src 'self' https://api.example.test");
    expect(directive(prod, 'frame-src')).toBe("frame-src 'none'");
    expect(directive(prod, 'img-src')).toBe("img-src 'self' data: blob:");
    expect(prod).not.toContain('unsafe-eval');
    expect(prod).not.toMatch(/ wss?:/);
    // nenhuma origem externa além da API própria
    const origins = prod.match(/https?:\/\/[^\s;]+/g) ?? [];
    expect(origins).toEqual(['https://api.example.test']);
    const dev = buildCsp('http://localhost:3001', true);
    expect(dev).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toBe("connect-src 'self' http://localhost:3001 ws: wss:");
  });

  it('IngestConsole em falha não exibe execução antiga como atual', async () => {
    const { IngestConsole } = await import('@/components/sala/IngestConsole');
    const html = renderToStaticMarkup(createElement(IngestConsole, { runs: { ok: false as const, status: 'unavailable' as const, error: 'x', attemptedAt: '2026-10-20T10:00:00Z' } }));
    expect(html).toContain('/v1/runs indisponível');
    expect(html).toContain('Nenhuma execução antiga');
  });
});

import { defaultWeekIndex } from '@/lib/timeline';

describe('defaultWeekIndex', () => {
  it('escolhe a última semana com cobertura razoável de países, não a última semana ISO', () => {
    const weeks = Array.from({ length: 10 }, (_, i) => `2026-W${String(i + 1).padStart(2, '0')}`);
    // 20 países reportam até W08; em W09 só 3 e em W10 só 1
    const countries = Array.from({ length: 20 }, (_, c) => ({ values: weeks.map((_, i) => (i <= 7 ? 1 : c < (i === 8 ? 3 : 1) ? 1 : null)) }));
    expect(defaultWeekIndex(weeks, countries)).toBe(7);
    expect(defaultWeekIndex(weeks, [])).toBe(9);
    expect(defaultWeekIndex([], countries)).toBe(0);
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

describe('sem conexão externa em runtime (só o próprio site e a API própria)', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      const f = path.join(dir, e);
      if (statSync(f).isDirectory()) walk(f, out);
      else if (/\.(ts|tsx|css)$/.test(e)) out.push(f);
    }
    return out;
  };
  const FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
    [/<iframe/i, 'iframe'],
    [/fetch\(\s*[`'"]https?:/, 'fetch para URL absoluta'],
    [/\bsrc=\{?\s*[`'"]https?:/, 'src externo'],
    [/url\(\s*['"]?https?:/, 'url() externa em CSS'],
    [/from ['"](ai|@ai-sdk\/[^'"]+|cmdk)['"]/, 'SDK de IA ou paleta cmdk'],
    [/nextstrain\.org/i, 'Nextstrain'],
  ];

  it('src/ não tem iframe, fetch/src/url() para outra origem nem SDK de IA', () => {
    const hits = walk(path.join(process.cwd(), 'src')).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => FORBIDDEN.filter(([re]) => re.test(line)).map(([, what]) => `${path.relative(process.cwd(), file)}:${i + 1}: ${what}`)),
    );
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('package.json não depende de SDK de IA nem da paleta cmdk', () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => d === 'ai' || d === 'cmdk' || d.startsWith('@ai-sdk/'))).toEqual([]);
  });
});


// ---------------------------------------------------------------------------------------------------------------------
// v4 · páginas de dados no sistema "papel, cinema, dado"
// ---------------------------------------------------------------------------------------------------------------------

describe('mapa por UF (SSR): legenda, tabela equivalente e seletor', () => {
  const ufs = [
    { code: 'BR-SP', uf: 'SP', name: 'São Paulo', ibge: '35', values: [120], suppressed: [false] },
    { code: 'BR-AC', uf: 'AC', name: 'Acre', ibge: '12', values: [null], suppressed: [true] },
    { code: 'BR-RR', uf: 'RR', name: 'Roraima', ibge: '14', values: [null], suppressed: [false] },
    { code: 'BR-DF', uf: 'DF', name: 'Distrito Federal', ibge: '53', values: [0], suppressed: [false] },
  ];
  const paths = ufs.map((u, i) => ({ uf: u.uf, name: u.name, d: `M${i * 20},0L${i * 20 + 15},0L${i * 20 + 15},15Z`, cx: i * 20 + 8, cy: 8, w: 40 }));
  const props = { states: ufs, weekIndex: 0, week: '2026-W40', max: 120, unit: 'notifications', threshold: 5, indicatorName: 'SRAG por A(H1N1)pdm09 confirmada', provisional: true };

  it('legenda traz "<5, ocultado por privacidade" e "sem dado publicado" com desenhos distintos (hachura x pontilhado)', async () => {
    const { BrazilMap } = await import('@/components/sala/BrazilMap');
    const html = renderToStaticMarkup(createElement(BrazilMap, { ...props, paths }));
    const legend = /aria-label="Legenda do mapa">([\s\S]*?)<\/ul>/.exec(html)![1]!;
    expect(legend).toContain('&lt;5, ocultado por privacidade');
    expect(legend).toContain('sem dado publicado');
    expect(legend).toContain('0'); // zero publicado tem cor própria
    expect(html).toMatch(/<pattern id="hs-[^"]+"/);
    expect(html).toMatch(/<pattern id="dn-[^"]+"/);
    // Acre (suprimido) usa a hachura; Roraima (sem dado) usa o pontilhado
    const fillOf = (uf: string) => new RegExp(`<path d="[^"]+" class="uf-path" fill="url\\(#(hs|dn)-[^)]+\\)"[^>]*aria-label="[^"]*\\(${uf}\\)`).exec(html)?.[1];
    expect(fillOf('AC')).toBe('hs');
    expect(fillOf('RR')).toBe('dn');
    expect(html).toContain('provisório');
  });

  it('tabela equivalente ("Ver como tabela") em ordem alfabética, com "<5" e "sem dado"; nunca o valor suprimido', async () => {
    const { BrazilMap } = await import('@/components/sala/BrazilMap');
    const withLeak = ufs.map((u) => (u.uf === 'AC' ? { ...u, values: [4242] } : u));
    const html = renderToStaticMarkup(createElement(BrazilMap, { ...props, states: withLeak, paths }));
    expect(html).toContain('Ver como tabela');
    const table = /<table[\s\S]*<\/table>/.exec(html)![0]!;
    const order = ['Acre', 'Distrito Federal', 'Roraima', 'São Paulo'].map((n) => table.indexOf(n));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(table).toContain('&lt;5');
    expect(table).toContain('ocultado por privacidade');
    expect(table).toContain('sem dado');
    expect(html).not.toContain('4242');
    expect(html).not.toContain('4.242');
  });

  it('seletor de UF por formulário GET, UF como link e nenhuma ordenação/ranking', async () => {
    const { BrazilMap } = await import('@/components/sala/BrazilMap');
    const html = renderToStaticMarkup(createElement(BrazilMap, { ...props, paths, selectedUf: 'SP', ufHref: '/dados/brasil/?uf={uf}', ufForm: { action: '/dados/brasil/', hidden: { indicador: 'x' }, selected: 'SP' } }));
    expect(html).toMatch(/<form[^>]*action="\/dados\/brasil\/" method="get"/);
    expect(html).toContain('<select');
    expect(html).toContain('name="uf"');
    expect(html).toContain('<input type="hidden" name="indicador" value="x"/>');
    expect(html).toContain('href="/dados/brasil/?uf=AC"');
    expect(html).not.toMatch(/ranking|posição/i);
  });

  it('sem os caminhos do servidor o SVG ainda não existe, mas legenda e tabela já estão no HTML', async () => {
    const { BrazilMap } = await import('@/components/sala/BrazilMap');
    const html = renderToStaticMarkup(createElement(BrazilMap, props));
    expect(html).toContain('Carregando malha de UFs');
    expect(html).toContain('ocultado por privacidade');
    expect(html).toContain('Ver como tabela');
  });

  it('com a malha real do IBGE o servidor entrega as 27 UFs no SVG (SSR do mapa)', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const { loadUfPaths } = await import('@/components/sala/uf-paths.server');
    const { getBrazilMap } = await import('@/lib/api');
    const { BrazilMap } = await import('@/components/sala/BrazilMap');
    const real = await loadUfPaths();
    expect(real?.length).toBe(27);
    expect(real!.every((p) => p.d.startsWith('M') && p.w > 0)).toBe(true);
    // regressão: sem reorientar os anéis cada UF vira o complemento da esfera e ocupa o viewBox inteiro (560 × 540)
    expect(real!.every((p) => p.w < 300)).toBe(true);
    expect(real!.find((p) => p.uf === 'DF')!.w).toBeLessThan(20);
    expect(real!.find((p) => p.uf === 'AM')!.w).toBeGreaterThan(150);
    const m = await getBrazilMap({ indicator: 'sivep_srag_ah1n1pdm09_deaths' });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const i = m.data.weeks.length - 1;
    const html = renderToStaticMarkup(createElement(BrazilMap, { states: m.data.states, weekIndex: i, week: m.data.weeks[i]!, max: 10, unit: 'deaths', threshold: 5, indicatorName: m.data.indicator.name, provisional: false, paths: real }));
    expect((html.match(/class="uf-path"/g) ?? []).length).toBe(27);
    expect(html).toContain('Ver como tabela');
  });
});

describe('número gigante e contagem (SSR)', () => {
  const base = {
    id: 'ultimo-valor',
    kicker: '( 01 ) Último valor publicado',
    indicatorName: 'SRAG por A(H1N1)pdm09 confirmada por RT-PCR',
    definition: 'Caso de SRAG hospitalizado com RT-PCR positivo para A(H1N1)pdm09.',
    value: 1234,
    suppressed: false,
    threshold: 5,
    unit: 'notifications',
    unitLabel: 'notificações',
    period: 'SE 41/2026',
    periodRange: 'de 05/10/2026 a 11/10/2026',
    provisional: true,
    universe: 'Hospitalizações por SRAG notificadas ao SIVEP-Gripe.',
    geography: 'Brasil',
    source: { name: 'SIVEP-Gripe', agency: 'Ministério da Saúde', href: '/dados/fontes/br_sivep_gripe/' },
    baseDate: '13/10/2026',
  };

  it('o número final e TODOS os rótulos estão no HTML do servidor; a contagem usa um clone aria-hidden vazio', async () => {
    const { BigNumber } = await import('@/components/sala/BigNumber');
    const html = renderToStaticMarkup(createElement(BigNumber, base));
    for (const t of ['SRAG por A(H1N1)pdm09 confirmada por RT-PCR', 'RT-PCR positivo', '1.234', 'notificações', 'SE 41/2026', 'de 05/10/2026 a 11/10/2026', 'Provisório', 'provisória (sujeita a revisão)', 'Hospitalizações por SRAG', 'href="/dados/fontes/br_sivep_gripe', 'Ministério da Saúde', 'Base de', '13/10/2026', 'Geografia', 'Universo']) {
      expect(html, t).toContain(t);
    }
    expect(html).toContain('class="bignum"');
    // clone da contagem: aria-hidden, oculto e sem texto (a animação só roda no cliente)
    expect(html).toMatch(/<span aria-hidden="true" hidden="" class="[^"]*"><\/span>/);
    expect(html).not.toMatch(/tempo real/i);
  });

  it('consolidado diz "consolidada"; suprimido mostra "<5" estático, sem o valor e sem contagem', async () => {
    const { BigNumber } = await import('@/components/sala/BigNumber');
    const fin = renderToStaticMarkup(createElement(BigNumber, { ...base, provisional: false }));
    expect(fin).toContain('Consolidado');
    expect(fin).toContain('consolidada');
    const sup = renderToStaticMarkup(createElement(BigNumber, { ...base, value: 4242, suppressed: true }));
    expect(sup).toContain('&lt;5');
    expect(sup).toContain('ocultado por privacidade');
    expect(sup).not.toContain('4242');
    expect(sup).not.toContain('4.242');
  });

  it('CountUp: valor final no HTML (SSR), nulo mostra o texto estático informado', async () => {
    const { CountUp } = await import('@/components/sala/CountUp');
    expect(renderToStaticMarkup(createElement(CountUp, { value: 98765 }))).toContain('98.765');
    expect(renderToStaticMarkup(createElement(CountUp, { value: null, empty: '<5' }))).toContain('&lt;5');
    expect(renderToStaticMarkup(createElement(CountUp, { value: 12.5, unit: 'percent' }))).toContain('12,5%');
  });
});

describe('páginas de dados (SSR com a API em modo mock)', () => {
  const FORBIDDEN_IN_MARKUP = /tempo real|ao vivo|hud-|scanlines|cursor-blink|\buppercase\b|\btext-xs\b|text-\[(?:10|11|13)px\]/i; // 12 px só nos rótulos de eixo do scrubber
  /** Primeiro trecho proibido (com contexto) ou null: a mensagem de erro do teste mostra onde está. */
  const forbidden = (html: string): string | null => {
    const m = FORBIDDEN_IN_MARKUP.exec(html);
    return m ? html.slice(Math.max(0, m.index - 80), m.index + 80) : null;
  };

  it('/dados/brasil: kicker, H1, número gigante com rótulos, série, mapa com legenda e tabela, sem ranking nem tempo real', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const { default: Page } = await import('@/app/dados/brasil/page');
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('[ Observatório · SIVEP-Gripe e FluNet ]');
    expect(html).toMatch(/<h1 class="display-lg[^"]*">H1N1 no Brasil<\/h1>/);
    const big = /<article id="ultimo-valor"[\s\S]*?<\/article>/.exec(html)![0]!;
    expect(big).toContain('class="bignum"');
    for (const t of ['Período', 'Situação', 'Geografia', 'Universo', 'Fonte', 'Base de']) expect(big, t).toContain(t);
    expect(big).toMatch(/href="\/dados\/fontes\/[^"]+"/);
    expect(html).toContain('Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.');
    expect(html).toContain('&lt;5, ocultado por privacidade');
    expect(html).toContain('sem dado publicado');
    expect(html).toContain('Ver como tabela');
    expect(html).toContain('provisória'); // cauda provisória na legenda/tabela
    expect(html).not.toMatch(/Ranking de UFs/);
    expect(forbidden(html)).toBeNull();
  });

  it('/dados/brasil com indicador FluNet (sem mapa) e UF ignorada continua válido', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const { default: Page } = await import('@/app/dados/brasil/page');
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ indicador: 'flunet_ah1n1pdm09_detections', uf: 'SP' }) }));
    expect(html).toContain('o filtro de UF foi ignorado');
    expect(html).toContain('class="bignum"');
    expect(html).not.toContain('id="h-mapa"');
    expect(forbidden(html)).toBeNull();
  });

  it('/dados/mundo: número gigante da semana com rótulos + globo + tabela por país', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const { default: Page } = await import('@/app/dados/mundo/page');
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('[ FluNet · OMS/GISRS ]');
    expect(html).toContain('class="bignum"');
    expect(html).toContain('Detecções laboratoriais de A(H1N1)pdm09 reportadas à OMS');
    expect(html).toMatch(/Semana ISO \d+ · \d{4}/);
    expect(html).toContain('Base de');
    expect(html).toContain('Comparar');
    expect(forbidden(html)).toBeNull();
  });

  it('/sala: capítulos ( 01 )…( 05 ), contadores, scrubber, EARS, composição e execuções, sem HUD, sem ranking de UFs, sem tempo real', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const { default: Page } = await import('@/app/sala/page');
    const html = renderToStaticMarkup(await Page());
    for (const t of ['( 01 ) Mundo', '( 02 ) Brasil', '( 03 ) Tendência', '( 04 ) Composição', '( 05 ) Execuções', '[ Sala de dados · FluNet e SIVEP-Gripe ]', 'H1N1 em números']) expect(html, t).toContain(t);
    expect(html).toMatch(/Semana ISO \d+ · \d{4}/);
    expect(html).not.toContain('SEMANA ISO');
    expect(html).toContain('Sinal estatístico, não surto confirmado.');
    expect(html).toContain('console-line');
    expect(html).toContain('&lt;5, ocultado por privacidade');
    expect(html).toContain('Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.');
    expect(html).not.toMatch(/Ranking de UFs/);
    expect(forbidden(html)).toBeNull();
  });
});

describe('piso de 14 px e tipografia nos arquivos de dados', () => {
  const ROOTS = ['src/components/sala', 'src/components/charts', 'src/app/dados/brasil', 'src/app/dados/mundo', 'src/app/sala'];
  const walkFiles = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      const f = path.join(dir, e);
      if (statSync(f).isDirectory()) walkFiles(f, out);
      else if (/\.(ts|tsx)$/.test(e)) out.push(f);
    }
    return out;
  };
  const files = [...ROOTS.flatMap((r) => walkFiles(path.join(process.cwd(), r))), path.join(process.cwd(), 'src/components/IndicatorCard.tsx')];

  it('nenhum text-xs / text-[10–13px], uppercase, negrito em serifa, "Hud" ou "tempo real" nos componentes de dados', () => {
    const hits = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => {
          const rel = path.relative(process.cwd(), file);
          const out: string[] = [];
          if (/\btext-xs\b|text-\[(?:10|11|13)px\]/.test(line)) out.push('texto < 14 px');
          // rótulos de eixo do scrubber são a única exceção declarada (12 px)
          if (/text-\[12px\]/.test(line) && !rel.endsWith('TimeScrubber.tsx')) out.push('texto 12 px fora de eixo');
          if (/\buppercase\b/.test(line)) out.push('uppercase');
          if (/font-display[^'"`]*font-(?:bold|extrabold|semibold)/.test(line)) out.push('negrito em Instrument Serif');
          if (/\bHud[A-Z]|hud-|HUD_COLORS/.test(line)) out.push('nome de HUD');
          if (/tempo real/i.test(line) && !/n[aã]o|nunca|sem/i.test(line)) out.push('tempo real');
          return out.map((o) => `${rel}:${i + 1}: ${o}`);
        }),
    );
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('os componentes renomeados existem e os antigos não', () => {
    const names = files.map((f) => path.basename(f));
    for (const n of ['DataTopbar.tsx', 'DataFooter.tsx', 'DataCounters.tsx']) expect(names).toContain(n);
    for (const n of ['HudTopbar.tsx', 'HudFooter.tsx', 'HudCounters.tsx']) expect(names).not.toContain(n);
  });
});

describe('cores de gráfico: contraste ≥ 3:1 sobre o papel (WCAG 1.4.11)', () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };

  it('linhas h1n1, h3, infb, srag/provisório, cinza e primário passam em 3:1 sobre o papel e o cartão', async () => {
    const { CHART_COLORS } = await import('@/lib/echarts-theme');
    for (const k of ['primary', 'h1n1', 'h3', 'infb', 'srag', 'gray', 'lineStrong'] as const) {
      expect(contrast(CHART_COLORS[k], '#f4f1ea'), k).toBeGreaterThanOrEqual(3);
      expect(contrast(CHART_COLORS[k], '#fbfaf7'), k).toBeGreaterThanOrEqual(3);
    }
  });

  it('o tema ECharts é transparente (papel por trás) e sem as cores neon/azul-acinzentado antigas', async () => {
    const { ECHARTS_THEME } = await import('@/lib/echarts-theme');
    expect(ECHARTS_THEME.backgroundColor).toBe('transparent');
    const json = JSON.stringify(ECHARTS_THEME).toLowerCase();
    for (const old of ['#0f9f93', '#f29a0a', '#9aa5b4', '#e3e8f0', '#0b1220', 'manrope']) expect(json).not.toContain(old);
  });
});
