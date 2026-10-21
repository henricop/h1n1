import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeFluNetRows, normalizeFluNetStream, dataAsOfFromRows, FluNetRow, flunetUrl, flunetYearUrl, flunetAllYears, flunetConnector, newFluNetStats,
  validateCountries, resolveCountrySelection, readNdjson, PAGE, FLUNET_FIRST_YEAR,
} from '../src/connectors/flunet.js';
import type { GeoEntry, NormalizeContext } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const env = JSON.parse(readFileSync(join(here, 'fixtures', 'flunet_bra_3rows.json'), 'utf8')) as { value: unknown[] };

const find = (obs: ReturnType<typeof normalizeFluNetRows>, id: string, period: string, stratum: Record<string, string> = {}) =>
  obs.find((o) => o.indicator_id === id && o.period === period && JSON.stringify(o.stratum) === JSON.stringify(stratum));

describe('flunet normalize', () => {
  const geo: GeoEntry[] = [];
  const obs = normalizeFluNetRows(env.value, 'snap', geo);

  it('agrega total = soma das origens, ignorando nulos', () => {
    expect(find(obs, 'flunet_specimens_processed', '2026-W41')!.value).toBe(4218 + 92);
    expect(find(obs, 'flunet_ah1n1pdm09_detections', '2026-W41')!.value).toBe(4);
    // INF_A é null na linha SENTINEL: total = 4 (não soma como zero), e o estrato SENTINEL não é emitido
    expect(find(obs, 'flunet_inf_a_detections', '2026-W41')!.value).toBe(4);
    expect(find(obs, 'flunet_inf_a_detections', '2026-W41', { origin_source: 'SENTINEL' })).toBeUndefined();
    expect(find(obs, 'flunet_inf_a_detections', '2026-W41', { origin_source: 'NONSENTINEL' })!.value).toBe(4);
    expect(find(obs, 'flunet_inf_all_detections', '2026-W41')!.value).toBe(108);
  });

  it('semana com uma origem só: total igual ao estrato', () => {
    expect(find(obs, 'flunet_ah3_detections', '2026-W40')!.value).toBe(2);
    expect(find(obs, 'flunet_ah3_detections', '2026-W40', { origin_source: 'NONSENTINEL' })!.value).toBe(2);
    expect(find(obs, 'flunet_ah3_detections', '2026-W40', { origin_source: 'SENTINEL' })).toBeUndefined();
  });

  it('razões: positividade com denominador e share nula quando INF_A < 20', () => {
    const pos = find(obs, 'flunet_influenza_positivity', '2026-W41')!;
    expect(pos.denominator).toBe(4310);
    expect(pos.value).toBeCloseTo(100 * 108 / 4310, 3);
    const share = find(obs, 'flunet_ah1n1pdm09_share_of_inf_a', '2026-W41')!;
    expect(share.value).toBeNull();
    expect(share.denominator).toBe(4);
    expect(find(obs, 'flunet_ah1n1pdm09_share_of_inf_a', '2026-W41', { origin_source: 'SENTINEL' })).toBeUndefined();
    expect(find(obs, 'flunet_influenza_positivity', '2026-W41', { origin_source: 'SENTINEL' })!.value).toBeCloseTo(100 * 6 / 92, 3);
  });

  it('período ISO, geo país, status provisório nas 4 últimas semanas, geo garantido', () => {
    const o = find(obs, 'flunet_ah1n1pdm09_detections', '2026-W41')!;
    expect(o.period_type).toBe('isoweek');
    expect(o.period_start).toBe('2026-10-05');
    expect(o.period_end).toBe('2026-10-11');
    expect(o.geo_level).toBe('country');
    expect(o.geo_code).toBe('BRA');
    expect(o.update_status).toBe('provisional');
    expect(geo).toEqual([{ code: 'BRA', level: 'country', name: 'Brazil', parent_code: 'WLD', iso2: 'BR' }]);
    expect(dataAsOfFromRows(env.value.map((r) => FluNetRow.parse(r)))).toBe('2026-10-11');
  });

  it('sem supressão na normalização (valor 0 e valores pequenos preservados)', () => {
    expect(find(obs, 'flunet_ah3_detections', '2026-W41')!.value).toBe(0);
    expect(find(obs, 'flunet_ah1n1pdm09_detections', '2026-W40')!.value).toBe(2);
  });

  it('numerador > denominador na origem: valor nulo com flag, nunca > 100', () => {
    const rows = [{ ...(env.value[2] as Record<string, unknown>), SPEC_PROCESSED_NB: 25, INF_ALL: 30 }];
    const o = normalizeFluNetRows(rows, 's').find((x) => x.indicator_id === 'flunet_influenza_positivity' && Object.keys(x.stratum).length === 0)!;
    expect(o.value).toBeNull();
    expect(o.denominator).toBe(25);
    expect(o.quality_flags).toContain('numerator_exceeds_denominator');
  });

  it('URL OData com filtro por país', () => {
    expect(flunetUrl('BRA')).toContain("COUNTRY_CODE%20eq%20'BRA'");
  });

  it('linhas duplicadas por (COUNTRY_CODE, ISO_YEAR, ISO_WEEK, ORIGIN_SOURCE): só a primeira conta; conflitantes vs idênticas', () => {
    const rows = [...env.value, { ...(env.value[2] as Record<string, unknown>), AH1N12009: 999 }];
    const stats = newFluNetStats();
    const out = normalizeFluNetRows(rows, 's', undefined, stats);
    expect(stats.rows).toBe(4);
    expect(stats.duplicates).toBe(1);
    expect(stats.duplicates_conflicting).toBe(1);
    expect(stats.duplicates_identical).toBe(0);
    expect(stats.duplicate_samples[0]).toBe('BRA|2026|40|NONSENTINEL');
    expect(stats.conflict_samples).toEqual(['BRA|2026|40|NONSENTINEL']);
    // cópia idêntica (como as 81 linhas do Butão na view global): descartada e contada como idêntica, sem conflito
    const st2 = newFluNetStats();
    normalizeFluNetRows([...env.value, { ...(env.value[2] as Record<string, unknown>) }], 's', undefined, st2);
    expect(st2).toMatchObject({ duplicates: 1, duplicates_identical: 1, duplicates_conflicting: 0, conflict_samples: [] });
    // valores iguais aos da normalização sem a duplicata
    expect(find(out, 'flunet_ah1n1pdm09_detections', '2026-W40')!.value).toBe(2);
    expect(out).toHaveLength(obs.length);
  });

  it('ORIGIN_SOURCE desconhecido não derruba a execução: entra no total com flag origin_source_unknown, sem estrato', () => {
    const rows = [...env.value, { ...(env.value[2] as Record<string, unknown>), ORIGIN_SOURCE: 'OUTRA', AH1N12009: 3, INF_A: 3 }];
    const stats = newFluNetStats();
    const out = normalizeFluNetRows(rows, 's', undefined, stats);
    expect(stats.origin_source_unknown).toBe(1);
    expect(stats.unknown_origins).toEqual({ OUTRA: 1 });
    const total = find(out, 'flunet_ah1n1pdm09_detections', '2026-W40')!;
    expect(total.value).toBe(2 + 3);
    expect(total.quality_flags).toContain('origin_source_unknown');
    expect(find(out, 'flunet_ah1n1pdm09_detections', '2026-W40', { origin_source: 'OUTRA' })).toBeUndefined();
    expect(find(out, 'flunet_ah1n1pdm09_detections', '2026-W40', { origin_source: 'NONSENTINEL' })!.value).toBe(2);
    expect(find(out, 'flunet_ah1n1pdm09_detections', '2026-W40', { origin_source: 'NONSENTINEL' })!.quality_flags).not.toContain('origin_source_unknown');
    expect(find(out, 'flunet_ah1n1pdm09_detections', '2026-W41')!.quality_flags).not.toContain('origin_source_unknown');
    // nenhum estrato fora do stratum_schema é emitido
    expect(out.every((o) => !o.stratum.origin_source || ['SENTINEL', 'NONSENTINEL', 'NOTDEFINED'].includes(o.stratum.origin_source))).toBe(true);
  });

  it('--country: só ISO3 (A-Z{3}); inválidos são rejeitados antes de montar o filtro OData', async () => {
    expect(validateCountries(['bra', ' usa '])).toEqual(['BRA', 'USA']);
    expect(() => validateCountries(['BRA', "X' or 1 eq 1"])).toThrow(/inválido/);
    expect(() => validateCountries(['BR'])).toThrow(/BR/);
    expect(() => flunetUrl("BRA' or 1")).toThrow();
    const realFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => { called = true; throw new Error('rede não deveria ser usada'); }) as typeof fetch;
    try {
      await expect(flunetConnector.fetch({ options: { countries: ['BRA', 'B R A'] }, log: () => {}, tmpDir: '/tmp' })).rejects.toThrow(/inválido/);
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(called).toBe(false);
  });

  it('COUNTRY_CODE fora de ISO3 (X09..X12) é ignorado e contado; geo só para códigos válidos', () => {
    const rows = [...env.value, { ...(env.value[2] as Record<string, unknown>), COUNTRY_CODE: 'X09', COUNTRY_AREA_TERRITORY: 'England', ISO2: null }];
    const stats = newFluNetStats();
    const geo: GeoEntry[] = [];
    const out = normalizeFluNetRows(rows, 's', geo, stats);
    expect(stats.rows).toBe(4);
    expect(stats.country_code_ignored).toBe(1);
    expect(stats.ignored_country_codes).toEqual({ X09: 1 });
    expect(stats.duplicates).toBe(0);
    expect(geo.map((g) => g.code)).toEqual(['BRA']);
    expect(out.every((o) => o.geo_code === 'BRA')).toBe(true);
  });

  it('seleção de países: --all ou --country ALL = view inteira; senão lista ISO3 (default BRA)', () => {
    expect(resolveCountrySelection({})).toEqual({ all: false, countries: ['BRA'] });
    expect(resolveCountrySelection({ countries: ['usa', 'ARG'] })).toEqual({ all: false, countries: ['USA', 'ARG'] });
    expect(resolveCountrySelection({ countries: ['ALL'] })).toEqual({ all: true });
    expect(resolveCountrySelection({ countries: ['all'] })).toEqual({ all: true });
    expect(resolveCountrySelection({ all: true })).toEqual({ all: true });
    expect(() => resolveCountrySelection({ countries: ['BR'] })).toThrow(/inválido/);
    expect(flunetYearUrl(2009, 0)).toBe('https://xmart-api-public.who.int/FLUMART/VIW_FNT?$filter=ISO_YEAR%20eq%202009&$orderby=ISOYW,COUNTRY_CODE,ORIGIN_SOURCE&$top=5000&$skip=0&$count=true');
    expect(flunetYearUrl(2009, 10000)).toBe('https://xmart-api-public.who.int/FLUMART/VIW_FNT?$filter=ISO_YEAR%20eq%202009&$orderby=ISOYW,COUNTRY_CODE,ORIGIN_SOURCE&$top=5000&$skip=10000');
    const years = flunetAllYears(new Date('2026-10-20T00:00:00Z'));
    expect(years[0]).toBe(FLUNET_FIRST_YEAR);
    expect(years[years.length - 1]).toBe(2027);
    expect(flunetAllYears(new Date('2024-12-30T00:00:00Z')).at(-1)).toBe(2026); // 2024-12-30 é 2025-W01
  });
});

describe('flunet streaming (normalize por país)', () => {
  it('emite um lote por país, em ordem, chamando ensureGeo antes de cada lote', async () => {
    const base = env.value[2] as Record<string, unknown>;
    const rows = [
      ...env.value,
      { ...base, COUNTRY_CODE: 'ARG', COUNTRY_AREA_TERRITORY: 'Argentina', ISO2: 'AR', AH1N12009: 7, INF_A: 10 },
      { ...base, COUNTRY_CODE: 'X10', COUNTRY_AREA_TERRITORY: 'Scotland', ISO2: null },
    ];
    async function* src() { for (const r of rows) yield r; }
    const stats = newFluNetStats();
    const order: string[] = [];
    const batches: Array<{ geoSeen: string[]; codes: Set<string> }> = [];
    for await (const b of normalizeFluNetStream(src(), 'snap', stats, (g) => order.push(g.code))) {
      batches.push({ geoSeen: [...order], codes: new Set(b.map((o) => o.geo_code)) });
    }
    expect(order).toEqual(['ARG', 'BRA']);
    expect(batches).toHaveLength(2);
    expect([...batches[0]!.codes]).toEqual(['ARG']);
    expect(batches[0]!.geoSeen).toEqual(['ARG']); // geo garantida antes do lote
    expect([...batches[1]!.codes]).toEqual(['BRA']);
    expect(stats.country_code_ignored).toBe(1);
    expect(stats.rows).toBe(5);
  });
});

describe('flunet fetch (paginação OData → NDJSON)', () => {
  const realFetch = globalThis.fetch;
  let tmp: string | null = null;
  afterEach(() => { globalThis.fetch = realFetch; if (tmp) rmSync(tmp, { recursive: true, force: true }); tmp = null; });

  const mkRow = (i: number, country = 'BRA') => ({
    ...(env.value[0] as Record<string, unknown>), COUNTRY_CODE: country, ISO_YEAR: 2025, ISO_WEEK: (i % 52) + 1,
    ISO_WEEKSTARTDATE: `2025-${String(Math.floor(i / 4) % 12 + 1).padStart(2, '0')}-0${(i % 4) + 1}`, ORIGIN_SOURCE: 'NONSENTINEL', AH1N12009: i,
  });

  it('modo ALL: partição por ano; segue @odata.nextLink, depois $skip acumulado enquanto a página vem cheia, e para na página curta', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'h1n1-flunet-'));
    const calls: string[] = [];
    const Y = FLUNET_FIRST_YEAR;
    // ano 1995 — página 1: 2 linhas + nextLink ($count=5003); página 2 (nextLink): PAGE linhas sem nextLink → $skip=5002; página 3: 1 linha → fim.
    // Demais anos: página vazia. Último ano = ano ISO corrente + 1.
    const page2 = Array.from({ length: PAGE }, (_, i) => mkRow(i, 'ARG'));
    const pages: Record<string, unknown> = {
      [flunetYearUrl(Y, 0)]: { '@odata.count': PAGE + 3, value: [mkRow(0), mkRow(1)], '@odata.nextLink': 'https://xmart-api-public.who.int/FLUMART/VIW_FNT?$skiptoken=abc' },
      'https://xmart-api-public.who.int/FLUMART/VIW_FNT?$skiptoken=abc': { value: page2 },
      [flunetYearUrl(Y, PAGE + 2)]: { value: [{ ...mkRow(2, 'X09'), ISO_WEEKSTARTDATE: '2026-10-12' }] },
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const body = pages[url] ?? (/\$filter=ISO_YEAR%20eq%20\d{4}&.*\$skip=0&\$count=true$/.test(url) ? { '@odata.count': 0, value: [] } : null);
      if (!body) return new Response('not found', { status: 404 });
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const raw = await flunetConnector.fetch({ options: { countries: ['ALL'] }, log: () => {}, tmpDir: tmp });
    const years = flunetAllYears();
    expect(calls.slice(0, 3)).toEqual([flunetYearUrl(Y, 0), 'https://xmart-api-public.who.int/FLUMART/VIW_FNT?$skiptoken=abc', flunetYearUrl(Y, PAGE + 2)]);
    expect(calls.slice(3)).toEqual(years.slice(1).map((y) => flunetYearUrl(y, 0)));
    expect(raw.urls).toEqual(calls);
    expect(raw.ext).toBe('ndjson');
    expect(raw.data_as_of).toBe('2026-10-18');
    expect(raw.extra).toMatchObject({ mode: 'all', countries: ['ALL'], years, rows: PAGE + 3, pages: 2 + years.length, countries_seen: 3, count_mismatches: [] });
    expect((raw.extra as { partitions: Record<string, number> }).partitions[`ALL:${Y}`]).toBe(PAGE + 3);
    const text = readFileSync(raw.path, 'utf8');
    expect(text.split('\n').filter(Boolean)).toHaveLength(PAGE + 3);
    expect(raw.bytes).toBe(Buffer.byteLength(text));
    // hash corresponde ao conteúdo gravado
    const { createHash } = await import('node:crypto');
    expect(createHash('sha256').update(text).digest('hex')).toBe(raw.sha256);
    // normalização em streaming do bruto: ARG com 5000 linhas (52 semanas × …: duplicatas por semana/origem são contadas), X09 ignorado
    const rows: unknown[] = [];
    for await (const r of readNdjson(raw.path)) rows.push(r);
    expect(rows).toHaveLength(PAGE + 3);
    const report: Record<string, unknown> = {};
    const geo: GeoEntry[] = [];
    const errors: string[] = [];
    let rowsIn = 0;
    const ctx: NormalizeContext = { snapshotId: 'snap', options: {}, log: () => {}, report, ensureGeo: (e) => geo.push(...e), countRowsIn: (n) => { rowsIn += n; }, addError: (m) => errors.push(m), setCoverage: () => {} };
    const out = flunetConnector.normalize(raw, ctx);
    const seen = new Set<string>();
    let total = 0;
    for await (const b of out as AsyncIterable<import('@h1n1/core').Observation[]>) { total += b.length; for (const o of b) seen.add(o.geo_code); }
    expect(rowsIn).toBe(PAGE + 3);
    expect([...seen].sort()).toEqual(['ARG', 'BRA']);
    expect(geo.map((g) => g.code)).toEqual(['ARG', 'BRA']);
    expect(report).toMatchObject({ mode: 'all', countries: ['ARG', 'BRA'], countries_count: 2, country_code_ignored: 1, ignored_country_codes: { X09: 1 }, rows: PAGE + 3, count_mismatches: [] });
    expect(total).toBeGreaterThan(0);
    // o fixture sintético repete (ARG, 2025, semana, origem) com AH1N12009 diferente: duplicatas conflitantes → addError (quarentena)
    expect(report.duplicates_conflicting as number).toBeGreaterThan(0);
    expect(errors.some((e) => /conflitantes/.test(e))).toBe(true);
  });

  it('$count divergente das linhas recebidas numa partição → addError (quarentena) e arquivo parcial removido em falha', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'h1n1-flunet-'));
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url === flunetUrl('BRA', 0)) return new Response(JSON.stringify({ '@odata.count': 9, value: [mkRow(0), mkRow(1)] }), { status: 200 });
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    }) as typeof fetch;
    const raw = await flunetConnector.fetch({ options: { countries: ['BRA'] }, log: () => {}, tmpDir: tmp });
    expect(raw.extra).toMatchObject({ count_mismatches: [{ label: 'BRA', expected: 9, received: 2 }] });
    const errors: string[] = [];
    const ctx: NormalizeContext = { snapshotId: 'snap', options: {}, log: () => {}, report: {}, ensureGeo: () => {}, countRowsIn: () => {}, addError: (m) => errors.push(m), setCoverage: () => {} };
    for await (const _b of flunetConnector.normalize(raw, ctx) as AsyncIterable<unknown>) { /* consome */ }
    expect(errors.join(' ')).toMatch(/\$count divergente.*BRA 2\/9/);
    // falha de rede no meio: o NDJSON parcial em tmp é removido
    globalThis.fetch = (async (input: string | URL | Request) => {
      if (String(input) === flunetUrl('BRA', 0)) return new Response(JSON.stringify({ value: Array.from({ length: PAGE }, (_, i) => mkRow(i)) }), { status: 200 });
      return new Response('erro', { status: 404 });
    }) as typeof fetch;
    await expect(flunetConnector.fetch({ options: { countries: ['BRA'] }, log: () => {}, tmpDir: tmp })).rejects.toThrow(/404/);
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(tmp).filter((f) => f.endsWith('.ndjson'))).toHaveLength(1); // só o da primeira chamada (bem-sucedida)
  });

  it('modo por país: uma sequência de páginas por ISO3, $skip quando a página vem cheia', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'h1n1-flunet-'));
    const calls: string[] = [];
    const pages: Record<string, unknown> = {
      [flunetUrl('BRA', 0)]: { value: [mkRow(0), mkRow(1)] },
      [flunetUrl('ARG', 0)]: { value: Array.from({ length: PAGE }, (_, i) => mkRow(i, 'ARG')) },
      [flunetUrl('ARG', PAGE)]: { value: [] },
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      const body = pages[String(input)];
      return new Response(JSON.stringify(body ?? { value: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const raw = await flunetConnector.fetch({ options: { countries: ['BRA', 'ARG'] }, log: () => {}, tmpDir: tmp });
    expect(calls).toEqual([flunetUrl('BRA', 0), flunetUrl('ARG', 0), flunetUrl('ARG', PAGE)]);
    expect(raw.extra).toMatchObject({ mode: 'countries', countries: ['BRA', 'ARG'], rows: PAGE + 2, pages: 3 });
  });
});
