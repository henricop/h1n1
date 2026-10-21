import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb, migrate, seedAll, publishIndicator, type Db } from '@h1n1/db';
import { epiWeekStart, toIsoDate } from '@h1n1/core';
import { buildApp } from '../src/app.js';
import { weeksBetween } from '../src/routes/analytics.js';
import { inferGeoLevel } from '../src/schemas.js';

const SIVEP = 'sivep_srag_ah1n1pdm09_confirmed';
const FLU = 'flunet_ah1n1pdm09_detections';
const DELAY = 'sivep_reporting_delay_cdf';
/** data da base: domingo da SE 2026-W20 → semanas 2026-W20 = 0 semanas atrás, W19 = 1, ... */
const DATA_AS_OF = toIsoDate(epiWeekStart(2026, 20));

let db: Db;
let app: FastifyInstance;

async function insertSnapshot(sourceId: string, dataAsOf: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into snapshots (source_id, url, sha256, status, data_as_of, license, storage_path)
     values ($1,'https://x',$2,'ok',$3,'CC-BY','/Users/alguem/data/snapshots/segredo.csv') returning id::text as id`,
    [sourceId, `hash-${sourceId}-${dataAsOf}-${Math.random()}`, dataAsOf],
  );
  return r.rows[0]!.id;
}

interface Cell {
  indicator: string; snap: string; level: string; geo: string; period: string; periodType?: string; value: number | null;
  denominator?: number | null; stratum?: Record<string, string>; status?: string;
}
async function insertObs(c: Cell) {
  const stratum = c.stratum ?? {};
  const key = Object.keys(stratum).sort().map((k) => `${k}=${stratum[k]}`).join(';');
  const pt = c.periodType ?? 'epiweek';
  let start = '2026-01-04';
  let end = '2026-01-10';
  if (pt === 'epiweek' || pt === 'isoweek') {
    const m = /^(\d{4})-W(\d{2})$/.exec(c.period)!;
    const s = epiWeekStart(Number(m[1]), Number(m[2]));
    start = toIsoDate(s);
    end = toIsoDate(new Date(s.getTime() + 6 * 86_400_000));
  } else if (pt === 'year') {
    start = `${c.period}-01-01`;
    end = `${c.period}-12-31`;
  }
  await db.query(
    `insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end, value, denominator, stratum, stratum_key, update_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
    [c.indicator, c.snap, c.level, c.geo, pt, c.period, start, end, c.value, c.denominator ?? null, JSON.stringify(stratum), key, c.status ?? 'final'],
  );
}

const W = (n: number) => `2026-W${String(n).padStart(2, '0')}`;
/** semanas 1..20; pico nas 3 últimas */
const BRA_SERIES = [10, 12, 11, 9, 10, 11, 12, 10, 11, 10, 9, 11, 10, 12, 11, 10, 9, 60, 80, 95];
/** PR: série estável sem pico */
const PR_SERIES = [20, 22, 21, 19, 20, 21, 22, 20, 21, 20, 19, 21, 20, 22, 21, 20, 19, 20, 21, 22];
const CDF = [20, 50, 70, 85, 92, 95, 97, 98, 99, 99.5, 99.8, 100, 100];

beforeAll(async () => {
  db = await createDb({ databaseUrl: null, pgliteDir: 'memory://' });
  await migrate(db);
  await seedAll(db);

  // SIVEP: nacional (pico), PR (estável), AC (células < 5), SP (só parcial); última semana provisória
  const sivep = await insertSnapshot('BR-03', DATA_AS_OF);
  for (let i = 0; i < 20; i++) {
    const status = i >= 18 ? 'provisional' : 'final';
    await insertObs({ indicator: SIVEP, snap: sivep, level: 'country', geo: 'BRA', period: W(i + 1), value: BRA_SERIES[i]!, status });
    await insertObs({ indicator: SIVEP, snap: sivep, level: 'state', geo: 'BR-PR', period: W(i + 1), value: PR_SERIES[i]!, status });
    await insertObs({ indicator: SIVEP, snap: sivep, level: 'state', geo: 'BR-AC', period: W(i + 1), value: i === 19 ? 3 : 7, status });
  }
  await insertObs({ indicator: SIVEP, snap: sivep, level: 'state', geo: 'BR-SP', period: W(20), value: 30, status: 'provisional' });
  await publishIndicator(db, { indicatorId: SIVEP, snapshotId: sivep, dataAsOf: DATA_AS_OF });

  // Indicador de atraso: 13 estratos para BRA (2026) e um ano anterior incompleto; nada para BR-PR
  const delay = await insertSnapshot('BR-03', DATA_AS_OF);
  for (let d = 0; d <= 12; d++) {
    await insertObs({ indicator: DELAY, snap: delay, level: 'country', geo: 'BRA', period: '2026', periodType: 'year', value: CDF[d]!, denominator: 400, stratum: { delay_weeks: String(d) } });
  }
  await insertObs({ indicator: DELAY, snap: delay, level: 'country', geo: 'BRA', period: '2025', periodType: 'year', value: 30, denominator: 400, stratum: { delay_weeks: '0' } });
  await publishIndicator(db, { indicatorId: DELAY, snapshotId: delay, dataAsOf: DATA_AS_OF });

  // FluNet: BRA e USA (com centroide), XXX (sem centroide), ATF só com null; estrato SENTINEL para USA
  const flu = await insertSnapshot('INT-01', '2026-05-11');
  for (const [geo, vals] of [['BRA', [5, 7, 9]], ['USA', [50, null, 70]], ['XXX', [1, 1, 1]], ['ATF', [null, null, null]]] as const) {
    for (let i = 0; i < 3; i++) {
      await insertObs({ indicator: FLU, snap: flu, level: 'country', geo, period: W(i + 1), periodType: 'isoweek', value: vals[i] });
    }
  }
  await insertObs({ indicator: FLU, snap: flu, level: 'country', geo: 'USA', period: W(2), periodType: 'isoweek', value: 11, stratum: { origin_source: 'SENTINEL' } });
  await publishIndicator(db, { indicatorId: FLU, snapshotId: flu, dataAsOf: '2026-05-11' });

  // Runs com caminho de disco no erro e params sensíveis
  await db.query(
    `insert into ingestion_runs (source_id, connector, status, rows_in, rows_out, error, params, finished_at)
     values ('BR-03', 'sivep', 'failed', 100, 0, $1, '{"path":"/Users/alguem/data/pglite"}', now())`,
    ['ENOENT: open /Users/alguem/Projects/h1n1/data/snapshots/INFLUD26.csv ' + 'detalhe '.repeat(60)],
  );
  await db.query(`insert into ingestion_runs (source_id, connector, status, rows_in, rows_out, finished_at) values ('INT-01', 'flunet', 'ok', 10, 10, now())`);

  app = await buildApp({ db, rateLimit: false });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.close();
});

const get = (url: string) => app.inject({ method: 'GET', url });

describe('/v1/globe', () => {
  it('devolve só países com centroide e algum valor, alinhados a weeks, com meta e cache/ETag', async () => {
    const res = await get(`/v1/globe?indicator=${FLU}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=300');
    expect(res.headers.etag).toBeDefined();
    const body = res.json();
    expect(body.indicator).toEqual({ id: FLU, name: expect.any(String) });
    expect(body.meta).toMatchObject({ data_as_of: '2026-05-11', source_id: 'INT-01', license: 'CC-BY' });
    expect(body.meta.universe_note).toContain('FluNet');
    expect(body.weeks).toEqual([W(1), W(2), W(3)]);
    expect(body.countries.map((c: { iso3: string }) => c.iso3)).toEqual(['BRA', 'USA']);
    const usa = body.countries[1];
    expect(usa).toMatchObject({ iso3: 'USA', name: 'United States of America', who_region: 'AMR', values: [50, null, 70] });
    expect(typeof usa.lat).toBe('number');
    expect(JSON.stringify(body)).not.toContain('XXX');
    expect(JSON.stringify(body)).not.toContain('ATF');
    expect(JSON.stringify(body)).not.toContain('storage_path');
    const r304 = await app.inject({ method: 'GET', url: `/v1/globe?indicator=${FLU}`, headers: { 'if-none-match': res.headers.etag as string } });
    expect(r304.statusCode).toBe(304);
  });

  it('respeita from/to e origin; rejeita indicador não FluNet (400) e inexistente (404)', async () => {
    const sub = (await get(`/v1/globe?indicator=${FLU}&from=${W(2)}&to=${W(2)}`)).json();
    expect(sub.weeks).toEqual([W(2)]);
    expect(sub.countries.map((c: { iso3: string }) => c.iso3)).toEqual(['BRA']);
    const sent = (await get(`/v1/globe?indicator=${FLU}&origin=SENTINEL`)).json();
    expect(sent.weeks).toEqual([W(2)]);
    expect(sent.countries).toHaveLength(1);
    expect(sent.countries[0]).toMatchObject({ iso3: 'USA', values: [11] });
    const bad = await get(`/v1/globe?indicator=${SIVEP}`);
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('validation_error');
    expect((await get('/v1/globe?indicator=nao_existe')).statusCode).toBe(404);
    expect((await get('/v1/globe')).statusCode).toBe(400);
    expect((await get(`/v1/globe?indicator=${FLU}&origin=foo`)).statusCode).toBe(400);
  });
});

describe('/v1/map/brazil', () => {
  it('27 UFs com supressão aplicada (valor < 5 nunca sai), total nacional com provisional', async () => {
    const res = await get(`/v1/map/brazil?indicator=${SIVEP}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers.etag).toBeDefined();
    const body = res.json();
    expect(body.weeks).toHaveLength(20);
    expect(body.states).toHaveLength(27);
    const ac = body.states.find((s: { uf: string }) => s.uf === 'AC');
    expect(ac).toMatchObject({ code: 'BR-AC', name: 'Acre', ibge: '12' });
    expect(ac.values[19]).toBeNull();
    expect(ac.suppressed[19]).toBe(true);
    expect(ac.values[0]).toBe(7);
    expect(ac.suppressed[0]).toBe(false);
    const sp = body.states.find((s: { uf: string }) => s.uf === 'SP');
    expect(sp.values.slice(0, 19).every((v: unknown) => v === null)).toBe(true);
    expect(sp.suppressed.every((v: boolean) => v === false)).toBe(true);
    expect(sp.values[19]).toBe(30);
    const am = body.states.find((s: { uf: string }) => s.uf === 'AM');
    expect(am.values.every((v: unknown) => v === null)).toBe(true);
    expect(body.national.values).toEqual(BRA_SERIES);
    expect(body.national.provisional.slice(-3)).toEqual([false, true, true]);
    expect(body.meta).toMatchObject({ data_as_of: DATA_AS_OF, source_id: 'BR-03' });
    expect(JSON.stringify(body)).not.toMatch(/"values":\[[^\]]*\b3\b/);
  });

  it('from/to e 400 para indicador sem nível state', async () => {
    const sub = (await get(`/v1/map/brazil?indicator=${SIVEP}&from=${W(19)}&to=${W(20)}`)).json();
    expect(sub.weeks).toEqual([W(19), W(20)]);
    expect(sub.national.values).toEqual([80, 95]);
    const bad = await get(`/v1/map/brazil?indicator=${FLU}`);
    expect(bad.statusCode).toBe(400);
    expect((await get(`/v1/map/brazil?indicator=${SIVEP}&from=${W(20)}&to=${W(19)}`)).statusCode).toBe(400);
  });
});

describe('/v1/analytics/ears', () => {
  it('sinaliza C1/C2/C3 no pico nacional e descreve o método', async () => {
    const res = await get(`/v1/analytics/ears?indicator=${SIVEP}&geo_code=BRA&weeks=3`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.method).toMatchObject({ name: 'EARS C1/C2/C3 (CDC), adaptado a semanas', baseline: 8, guard: 2, thresholds: { c1: 3, c2: 3, c3: 2 } });
    expect(body.method.note).toContain('não surto confirmado');
    expect(body.results).toHaveLength(3);
    expect(body.results[0]).toMatchObject({ geo_code: 'BRA', name: 'Brasil' });
    for (const r of body.results) {
      expect(r.flags).toContain('C2');
      expect(r.c2).toBeGreaterThan(3);
    }
    // C1 (sem guarda) dispara na primeira semana do pico; depois a própria baseline de C1 absorve o pico
    const first = body.results.find((r: { period: string }) => r.period === W(18));
    expect(first).toMatchObject({ value: 60, provisional: false });
    expect(first.flags).toContain('C1');
    const last = body.results.find((r: { period: string }) => r.period === W(20));
    expect(last).toMatchObject({ value: 95, provisional: true });
    expect(last.flags).toContain('C3');
    // ordenado por c2 desc
    const c2s = body.results.map((r: { c2: number }) => r.c2);
    expect([...c2s].sort((a, b) => b - a)).toEqual(c2s);
  });

  it('todas as UFs sem geo_code; suprimido entra como null; sem baseline → null; ordenação c2 desc com null por último', async () => {
    const res = await get(`/v1/analytics/ears?indicator=${SIVEP}&geo_level=state&weeks=1`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const geos = body.results.map((r: { geo_code: string }) => r.geo_code);
    expect(geos).toEqual(expect.arrayContaining(['BR-PR', 'BR-AC', 'BR-SP']));
    const ac = body.results.find((r: { geo_code: string }) => r.geo_code === 'BR-AC');
    expect(ac).toMatchObject({ period: W(20), value: null, c1: null, c2: null, c3: null, flags: [] });
    const sp = body.results.find((r: { geo_code: string }) => r.geo_code === 'BR-SP');
    expect(sp).toMatchObject({ value: 30, c1: null, c2: null, flags: [] });
    const pr = body.results.find((r: { geo_code: string }) => r.geo_code === 'BR-PR');
    expect(pr.name).toBe('Paraná');
    expect(pr.flags).toEqual([]);
    expect(body.results[0].geo_code).toBe('BR-PR');
    expect(JSON.stringify(body)).not.toMatch(/"value":3[,}]/);
    // parâmetros
    expect((await get(`/v1/analytics/ears?indicator=${FLU}&geo_level=state`)).statusCode).toBe(400);
    expect((await get(`/v1/analytics/ears?indicator=${SIVEP}&baseline=1`)).statusCode).toBe(400);
    expect((await get('/v1/analytics/ears?indicator=nao_existe')).statusCode).toBe(404);
    const custom = (await get(`/v1/analytics/ears?indicator=${SIVEP}&geo_code=BRA&weeks=1&baseline=4&guard=0`)).json();
    expect(custom.method).toMatchObject({ baseline: 4, guard: 0 });
  });
});

describe('/v1/analytics/nowcast', () => {
  it('usa a CDF publicada (13 estratos), conta weeks_ago pela data da base e devolve estimativa com intervalo', async () => {
    const res = await get(`/v1/analytics/nowcast?indicator=${SIVEP}&geo_code=BRA&weeks=4`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.delay).toEqual({ period: '2026', n: 400, cdf: CDF, source_indicator: DELAY });
    expect(body.note).toContain('Estimativa');
    expect(body.results.map((r: { period: string }) => r.period)).toEqual([W(17), W(18), W(19), W(20)]);
    expect(body.results.map((r: { weeks_ago: number }) => r.weeks_ago)).toEqual([3, 2, 1, 0]);
    const last = body.results[3];
    expect(last).toMatchObject({ observed: 95, reported_share: 0.2, estimated: 475 });
    expect(last.lower).toBeLessThan(475);
    expect(last.upper).toBeGreaterThan(475);
    expect(body.results[2]).toMatchObject({ observed: 80, reported_share: 0.5, estimated: 160 });
    expect(body.results[0]).toMatchObject({ observed: 9, reported_share: 0.85 });
    expect(body.meta).toMatchObject({ data_as_of: DATA_AS_OF, source_id: 'BR-03' });
  });

  it('404 nowcast_unavailable sem CDF para a geo; 400 para indicador não sivep de contagem', async () => {
    const pr = await get(`/v1/analytics/nowcast?indicator=${SIVEP}&geo_code=BR-PR`);
    expect(pr.statusCode).toBe(404);
    expect(pr.json().error.code).toBe('nowcast_unavailable');
    expect((await get(`/v1/analytics/nowcast?indicator=${FLU}`)).statusCode).toBe(400);
    expect((await get(`/v1/analytics/nowcast?indicator=${DELAY}`)).statusCode).toBe(400);
    expect((await get(`/v1/analytics/nowcast?indicator=${SIVEP}&weeks=99`)).statusCode).toBe(400);
  });

  it('weeksBetween conta semanas epidemiológicas entre o período e a data da base', () => {
    expect(weeksBetween('2026-W20', DATA_AS_OF, 'epiweek')).toBe(0);
    expect(weeksBetween('2026-W15', DATA_AS_OF, 'epiweek')).toBe(5);
    expect(weeksBetween('2025-W52', DATA_AS_OF, 'epiweek')).toBeGreaterThan(19);
  });
});

describe('/v1/analytics/seasons', () => {
  it('uma linha por ano com 53 semanas e from_year', async () => {
    const res = await get(`/v1/analytics/seasons?indicator=${SIVEP}&geo_code=BRA&from_year=2019`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.geo_code).toBe('BRA');
    expect(body.weeks).toHaveLength(53);
    expect(body.seasons).toHaveLength(1);
    expect(body.seasons[0].year).toBe(2026);
    expect(body.seasons[0].values.slice(0, 20)).toEqual(BRA_SERIES);
    expect(body.seasons[0].values[20]).toBeNull();
    expect(body.meta.universe_note).toContain('SRAG');
    const ac = (await get(`/v1/analytics/seasons?indicator=${SIVEP}&geo_code=BR-AC`)).json();
    expect(ac.seasons[0].values[19]).toBeNull();
    expect(ac.seasons[0].values[0]).toBe(7);
    expect((await get(`/v1/analytics/seasons?indicator=${DELAY}`)).statusCode).toBe(400);
    expect((await get(`/v1/analytics/seasons?indicator=${SIVEP}&from_year=2027`)).json().seasons).toEqual([]);
  });
});

describe('/v1/runs', () => {
  it('lista execuções sem caminhos de disco, erro truncado a 200 e sem params', async () => {
    const res = await get('/v1/runs?limit=10');
    expect(res.statusCode).toBe(200);
    expect(res.headers.etag).toBeDefined();
    const body = res.json();
    expect(body.data.length).toBe(2);
    const failed = body.data.find((r: { status: string }) => r.status === 'failed');
    expect(failed).toMatchObject({ connector: 'sivep', source_id: 'BR-03', rows_in: 100, rows_out: 0 });
    expect(typeof failed.id).toBe('string');
    expect(failed.error.length).toBeLessThanOrEqual(200);
    expect(failed.error).toContain('[caminho]');
    const text = JSON.stringify(body);
    expect(text).not.toContain('/Users');
    expect(text).not.toContain('INFLUD26');
    expect(text).not.toContain('pglite');
    expect(text).not.toContain('params');
    const ok = (await get('/v1/runs?source_id=INT-01')).json();
    expect(ok.data).toHaveLength(1);
    expect(ok.data[0]).toMatchObject({ status: 'ok', error: null, connector: 'flunet' });
    expect((await get('/v1/runs?limit=0')).statusCode).toBe(400);
  });
});

describe('/v1/indicators/:id/latest', () => {
  it('último período com valor, provisional e tendência vs 4 semanas anteriores', async () => {
    const res = await get(`/v1/indicators/${SIVEP}/latest?geo_code=BRA`);
    expect(res.statusCode).toBe(200);
    expect(res.headers.etag).toBeDefined();
    const body = res.json();
    expect(body.latest).toMatchObject({ period: W(20), value: 95, provisional: true, update_status: 'provisional' });
    expect(body.latest.period_start).toBe(toIsoDate(epiWeekStart(2026, 20)));
    // últimas 4: 9,60,80,95 (média 61) vs anteriores 12,11,10,9... → [10,12,11,10]? ver série: W13..W16 = 10,12,11,10 (média 10.75)
    expect(body.trend).toMatchObject({ k: 4, recent_mean: 61, previous_mean: 10.8 });
    expect(body.trend.change_pct).toBeCloseTo(467.4, 0);
    expect(body.meta).toMatchObject({ data_as_of: DATA_AS_OF, source_id: 'BR-03' });
  });

  it('pula a última célula suprimida (AC), devolve latest null sem dado e 404 para indicador inexistente', async () => {
    const ac = (await get(`/v1/indicators/${SIVEP}/latest?geo_code=BR-AC`)).json();
    expect(ac.latest).toMatchObject({ period: W(19), value: 7, provisional: true });
    expect(JSON.stringify(ac)).not.toMatch(/"value":3[,}]/);
    const none = (await get(`/v1/indicators/${SIVEP}/latest?geo_code=BR-AM`)).json();
    expect(none.latest).toBeNull();
    expect(none.trend.change_pct).toBeNull();
    const nopub = (await get('/v1/indicators/sivep_srag_notifications/latest')).json();
    expect(nopub.latest).toBeNull();
    expect(nopub.meta.data_as_of).toBeNull();
    expect((await get('/v1/indicators/nao_existe/latest')).statusCode).toBe(404);
  });
});

describe('inferGeoLevel', () => {
  it('BRA → country, BR-SP → state (BR-SE é Sergipe, não Sudeste), BR-R-SE → region, WLD → world', () => {
    expect(inferGeoLevel('BRA')).toBe('country');
    expect(inferGeoLevel('BR-SP')).toBe('state');
    expect(inferGeoLevel('BR-SE')).toBe('state');
    expect(inferGeoLevel('BR-R-NE')).toBe('region');
    expect(inferGeoLevel('BR-R-SE')).toBe('region');
    expect(inferGeoLevel('BR-CO')).toBe('country');
    expect(inferGeoLevel('WLD')).toBe('world');
  });
});

describe('openapi', () => {
  it('documenta as rotas novas', async () => {
    const spec = (await get('/openapi.json')).json();
    for (const p of ['/v1/globe', '/v1/map/brazil', '/v1/analytics/ears', '/v1/analytics/nowcast', '/v1/analytics/seasons', '/v1/runs', '/v1/indicators/{id}/latest']) {
      expect(spec.paths[p], p).toBeDefined();
    }
  });
});
