import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

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
  });
});

describe('escala do mapa e contadores do HUD', () => {
  it('mapCell trata nulo e suprimido como hachura, zero como cor própria e escala por raiz quadrada', async () => {
    const m = await import('@/lib/map-scale');
    expect(m.mapCell(null, false, 100).kind).toBe('nodata');
    expect(m.mapCell(50, true, 100).kind).toBe('suppressed');
    expect(m.mapCell(50, true, 100).fill).toBe(m.MAP_COLOR_NODATA);
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
  });

  it('IngestConsole em falha não exibe execução antiga como atual', async () => {
    const { IngestConsole } = await import('@/components/sala/IngestConsole');
    const html = renderToStaticMarkup(createElement(IngestConsole, { runs: { ok: false as const, status: 'unavailable' as const, error: 'x', attemptedAt: '2026-10-20T10:00:00Z' } }));
    expect(html).toContain('/v1/runs indisponível');
    expect(html).toContain('Nenhuma execução antiga');
  });
});
