import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('modo mock (H1N1_API_MOCK=1)', () => {
  it('lê fixtures e filtra a série por geografia e período', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const api = await import('@/lib/api');
    expect(api.isMockMode()).toBe(true);

    const s = await api.getSeries({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_level: 'country', geo_code: 'BRA' });
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.data.indicator.id).toBe('sivep_srag_ah1n1pdm09_confirmed');
    expect(s.data.meta.universe_note).toMatch(/não todos os casos de H1N1/);
    expect(s.data.observations.every((o) => o.geo_code === 'BRA' && Object.keys(o.stratum).length === 0)).toBe(true);
    expect(s.data.meta.count).toBe(s.data.observations.length);

    const sp = await api.getSeries({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_level: 'state', geo_code: 'BR-SP', from: '2026-W30', to: '2026-W33' });
    expect(sp.ok && sp.data.observations.length).toBe(4);

    const strata = await api.getSeries({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_level: 'country', geo_code: 'BRA', stratum: { age_group: '65+' } });
    expect(strata.ok && strata.data.observations.every((o) => o.stratum.age_group === '65+')).toBe(true);
  });

  it('células suprimidas nunca trazem valor', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const api = await import('@/lib/api');
    const s = await api.getSeries({ indicator: 'sivep_srag_ah1n1pdm09_deaths', geo_level: 'state', geo_code: 'BR-AP' });
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.data.observations.some((o) => o.suppressed)).toBe(true);
    expect(s.data.observations.filter((o) => o.suppressed).every((o) => o.value === null)).toBe(true);
  });

  it('fontes, indicadores, frescor e geo vêm das fixtures', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const api = await import('@/lib/api');
    const src = await api.getSources();
    expect(src.ok && src.data.data.length).toBe(65);
    const p0 = await api.getSources({ priority: 'P0', access_type: 'api' });
    expect(p0.ok && p0.data.data.every((s) => s.priority === 'P0' && s.access_type === 'api')).toBe(true);
    const one = await api.getSource('br_sivep_gripe');
    expect(one.ok && one.data.data.id).toBe('BR-03');
    const missing = await api.getSource('nao-existe');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe('not_found');
    const ind = await api.getIndicators();
    expect(ind.ok && ind.data.data.some((i) => i.id === 'flunet_ah1n1pdm09_detections')).toBe(true);
    const fresh = await api.getFreshness();
    expect(fresh.ok).toBe(true);
    expect(api.isStale(api.freshnessFor(fresh, 'sivep_srag_influenza_subtype_completeness'))).toBe(true);
    expect(api.isStale(api.freshnessFor(fresh, 'sivep_srag_ah1n1pdm09_confirmed'))).toBe(false);
    const geo = await api.getGeo('state');
    expect(geo.ok && geo.data.data.length).toBe(27);
  });

  it('seriesCsvUrl aponta para /v1/series.csv da API', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test');
    const api = await import('@/lib/api');
    expect(api.seriesCsvUrl({ indicator: 'x', geo_level: 'state', geo_code: 'BR-SP', stratum: { age_group: '0-4' } })).toBe(
      'https://api.example.test/v1/series.csv?indicator=x&geo_level=state&geo_code=BR-SP&stratum.age_group=0-4',
    );
  });
});

describe('falha de rede', () => {
  it("devolve status 'unavailable' sem lançar quando a API não responde", async () => {
    vi.stubEnv('H1N1_API_MOCK', '0');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:9'); // porta discard: conexão recusada
    const api = await import('@/lib/api');
    expect(api.isMockMode()).toBe(false);
    const r = await api.getFreshness();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe('unavailable');
    expect(r.attemptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.error).toMatch(/Falha ao acessar/);
    const s = await api.getSeries({ indicator: 'sivep_srag_ah1n1pdm09_confirmed' });
    expect(s.ok).toBe(false);
  });

  it('respostas HTTP de erro também viram unavailable/not_found', async () => {
    vi.stubEnv('H1N1_API_MOCK', '0');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
    const fetchMock = vi.fn(async (url: string) => new Response(url.includes('/v1/sources/x') ? 'nf' : 'err', { status: url.includes('/v1/sources/x') ? 404 : 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await import('@/lib/api');
    const nf = await api.getSource('x');
    expect(!nf.ok && nf.status).toBe('not_found');
    const err = await api.getIndicators();
    expect(!err.ok && err.status).toBe('unavailable');
    vi.unstubAllGlobals();
  });
});

describe('formatação de timestamps do Postgres', () => {
  it('aceita "YYYY-MM-DD HH:MM:SS+00" e ISO', async () => {
    const { formatDateTimeBR, normalizeTimestamp } = await import('@/lib/format');
    expect(normalizeTimestamp('2026-10-20 09:02:10+00')).toBe('2026-10-20T09:02:10+00:00');
    expect(formatDateTimeBR('2026-10-20 09:02:10+00')).toBe('20/10/2026 09:02 (UTC)');
    expect(formatDateTimeBR('2026-10-14T06:12:44.000Z')).toBe('14/10/2026 06:12 (UTC)');
  });
});
