import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb, migrate, seedAll, publishIndicator, type Db } from '@h1n1/db';
import { buildApp } from '../src/app.js';

const IND = 'sivep_srag_ah1n1pdm09_confirmed';
let db: Db;
let app: FastifyInstance;

beforeAll(async () => {
  db = await createDb({ databaseUrl: null, pgliteDir: 'memory://' });
  await migrate(db);
  await seedAll(db);
  app = await buildApp({ db, rateLimit: false });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.close();
});

async function insertSnapshot(sourceId: string, dataAsOf: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into snapshots (source_id, url, sha256, status, data_as_of, license) values ($1,'https://x',$2,'ok',$3,'CC-BY') returning id::text as id`,
    [sourceId, 'hash-' + dataAsOf, dataAsOf],
  );
  return r.rows[0]!.id;
}

const insertObs = (snap: string, geo: string, level: string, period: string, value: number, stratum = '{}', key = '') =>
  db.query(
    `insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end, value, stratum, stratum_key)
     values ($1, $2, $3, $4, 'epiweek', $5, '2026-01-04', '2026-01-10', $6, $7::jsonb, $8)`,
    [IND, snap, level, geo, period, value, stratum, key],
  );

describe('infra', () => {
  it('/health responde 200 com db pglite', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'pglite' });
    expect(typeof res.json().time).toBe('string');
  });

  it('rota desconhecida devolve 404 no formato de erro padrão', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/nada' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('/openapi.json contém os paths do contrato', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.info).toMatchObject({ title: 'H1N1 API', version: '0.1.0' });
    expect(doc.info.description).toContain('universe_note');
    for (const p of [
      '/health', '/v1/sources', '/v1/sources/{idOrSlug}', '/v1/indicators', '/v1/indicators/{id}', '/v1/series',
      '/v1/series.csv', '/v1/freshness', '/v1/snapshots', '/v1/snapshots/{id}', '/v1/diff', '/v1/geo',
    ]) expect(doc.paths, p).toHaveProperty(p);
    const ui = await app.inject({ method: 'GET', url: '/docs' });
    expect([200, 302]).toContain(ui.statusCode);
  });

  it('GET /v1/* leva Cache-Control e CORS', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/geo?level=country', headers: { origin: 'https://exemplo.org' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=600');
    expect(res.headers['access-control-allow-origin']).toBe('https://exemplo.org');
    expect(res.json().data.length).toBeGreaterThan(0);
    const bad = await app.inject({ method: 'GET', url: '/v1/geo?level=cidade' });
    expect(bad.statusCode).toBe(400);
    expect(bad.headers['cache-control']).toBeUndefined();
  });
});

describe('fontes e indicadores', () => {
  it('/v1/sources devolve 65 e P0 devolve 19', async () => {
    const all = await app.inject({ method: 'GET', url: '/v1/sources' });
    expect(all.statusCode).toBe(200);
    expect(all.json().count).toBe(65);
    expect(all.json().data).toHaveLength(65);
    const p0 = await app.inject({ method: 'GET', url: '/v1/sources?priority=P0' });
    expect(p0.json().count).toBe(19);
    const bad = await app.inject({ method: 'GET', url: '/v1/sources?priority=P9' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('/v1/sources/:idOrSlug aceita id e slug; 404 se não existir', async () => {
    const bySlug = await app.inject({ method: 'GET', url: '/v1/sources/br_sivep_gripe' });
    const byId = await app.inject({ method: 'GET', url: '/v1/sources/BR-03' });
    expect(bySlug.statusCode).toBe(200);
    expect(byId.statusCode).toBe(200);
    expect(bySlug.json().data).toEqual(byId.json().data);
    expect(byId.json().data.id).toBe('BR-03');
    expect(byId.json().indicators.length).toBeGreaterThan(0);
    const nf = await app.inject({ method: 'GET', url: '/v1/sources/nao-existe' });
    expect(nf.statusCode).toBe(404);
    expect(nf.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('/v1/indicators lista e filtra por fonte; /v1/indicators/:id traz publication e freshness', async () => {
    const all = await app.inject({ method: 'GET', url: '/v1/indicators' });
    expect(all.json().data.length).toBeGreaterThan(15);
    const bySrc = await app.inject({ method: 'GET', url: '/v1/indicators?source_id=BR-03' });
    expect(bySrc.json().data.every((i: { source_id: string }) => i.source_id === 'BR-03')).toBe(true);
    const one = await app.inject({ method: 'GET', url: `/v1/indicators/${IND}` });
    expect(one.statusCode).toBe(200);
    expect(one.json().data.id).toBe(IND);
    expect(one.json()).toHaveProperty('publication');
    expect(one.json().freshness).toMatchObject({ indicator_id: IND });
    const nf = await app.inject({ method: 'GET', url: '/v1/indicators/xyz' });
    expect(nf.statusCode).toBe(404);
  });
});

describe('séries', () => {
  it('sem indicator → 400; inexistente → 404; válido sem publicação → 200 vazio', async () => {
    const noInd = await app.inject({ method: 'GET', url: '/v1/series' });
    expect(noInd.statusCode).toBe(400);
    expect(noInd.json()).toMatchObject({ error: { code: 'validation_error' } });

    const unknown = await app.inject({ method: 'GET', url: '/v1/series?indicator=nao_existe' });
    expect(unknown.statusCode).toBe(404);

    const empty = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}` });
    expect(empty.statusCode).toBe(200);
    const body = empty.json();
    expect(body.observations).toEqual([]);
    expect(body.publication).toBeNull();
    expect(body.snapshot).toBeNull();
    expect(body.meta.data_as_of).toBeNull();
    expect(body.meta.count).toBe(0);
    expect(typeof body.meta.universe_note).toBe('string');
    expect(body.meta.universe_note.length).toBeGreaterThan(20);

    const badLevel = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_level=city` });
    expect(badLevel.statusCode).toBe(400);
    const badPeriod = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=ontem` });
    expect(badPeriod.statusCode).toBe(400);
  });

  it('devolve só a snapshot vigente, com supressão e sem vazar valor bruto; CSV correto', async () => {
    const s1 = await insertSnapshot('BR-03', '2026-10-12');
    const s2 = await insertSnapshot('BR-03', '2026-10-19');
    await insertObs(s1, 'BRA', 'country', '2026-W01', 10);
    await insertObs(s2, 'BRA', 'country', '2026-W01', 12);
    await insertObs(s2, 'BR-SC', 'state', '2026-W01', 3);
    await insertObs(s2, 'BR-SC', 'state', '2026-W01', 2, '{"age_group":"0-4"}', 'age_group=0-4');
    await insertObs(s2, 'BR-SC', 'state', '2026-W01', 1, '{"age_group":"65+"}', 'age_group=65+');
    await insertObs(s2, 'BR-SP', 'state', '2026-W01', 40);

    await publishIndicator(db, { indicatorId: IND, snapshotId: s1, dataAsOf: '2026-10-12' });
    let res = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA` });
    expect(res.statusCode).toBe(200);
    expect(res.json().observations[0].value).toBe(10);
    expect(res.json().meta.data_as_of).toBe('2026-10-12');
    expect(res.json().snapshot.id).toBe(s1);

    await publishIndicator(db, { indicatorId: IND, snapshotId: s2, dataAsOf: '2026-10-19' });
    res = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA` });
    const body = res.json();
    expect(body.observations).toHaveLength(1);
    expect(body.observations[0]).toMatchObject({ value: 12, suppressed: false, geo_code: 'BRA', snapshot_id: s2 });
    expect(body.snapshot.id).toBe(s2);
    expect(body.publication.snapshot_id).toBe(s2);
    expect(body.meta).toMatchObject({
      data_as_of: '2026-10-19',
      license: 'CC-BY',
      suppression_threshold: 5,
      count: 1,
    });
    expect(typeof body.meta.universe_note).toBe('string');
    expect(typeof body.meta.case_definition).toBe('string');
    expect(Array.isArray(body.meta.caveats)).toBe(true);
    expect(body.source.id).toBe('BR-03');
    expect(body.indicator.id).toBe(IND);

    // estados: células < 5 suprimidas, valor bruto nunca aparece
    const sc = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_level=state&geo_code=BR-SC&include_strata=true` });
    expect(sc.statusCode).toBe(200);
    const scBody = sc.json();
    expect(scBody.observations).toHaveLength(3);
    expect(scBody.observations.every((o: { value: unknown; suppressed: boolean }) => o.value === null && o.suppressed === true)).toBe(true);
    expect(sc.body).not.toContain('"value":3');
    expect(sc.body).not.toContain('"value":2');
    expect(sc.body).not.toContain('"value":1');

    // filtro por estrato
    const stratum = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BR-SC&stratum.age_group=0-4` });
    expect(stratum.json().observations).toHaveLength(1);
    expect(stratum.json().observations[0]).toMatchObject({ stratum: { age_group: '0-4' }, suppressed: true, value: null });

    // sem include_strata só totais
    const states = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_level=state` });
    expect(states.json().observations).toHaveLength(2);
    const sp = states.json().observations.find((o: { geo_code: string }) => o.geo_code === 'BR-SP');
    expect(sp).toMatchObject({ value: 40, suppressed: false });

    // CSV
    const csv = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}&geo_level=state&include_strata=true` });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toMatch(/^text\/csv/);
    expect(csv.headers['content-disposition']).toBe(`attachment; filename="${IND}.csv"`);
    expect(csv.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=600');
    const lines = csv.body.trim().split('\n');
    expect(lines[0]).toBe(
      'indicator_id,geo_level,geo_code,period_type,period,period_start,period_end,value,denominator,suppressed,update_status,stratum_key,quality_flags,snapshot_id,data_as_of,source_id,license',
    );
    expect(lines).toHaveLength(5);
    const scTotal = lines.find((l) => l.startsWith(`${IND},state,BR-SC,epiweek,2026-W01,2026-01-04,2026-01-10,`))!;
    expect(scTotal).toBe(`${IND},state,BR-SC,epiweek,2026-W01,2026-01-04,2026-01-10,,,true,provisional,,,${s2},2026-10-19,BR-03,CC-BY`);
    const spLine = lines.find((l) => l.includes(',BR-SP,'))!;
    expect(spLine).toContain(',40,,false,provisional,');
    expect(csv.body).not.toMatch(/,3,,true/);

    // diff entre snapshots
    const diff = await app.inject({ method: 'GET', url: `/v1/diff?indicator=${IND}&a=${s1}&b=${s2}` });
    expect(diff.statusCode).toBe(200);
    expect(diff.json().data.find((d: { geo_code: string }) => d.geo_code === 'BRA')).toMatchObject({ value_a: 10, value_b: 12 });
    const diffBad = await app.inject({ method: 'GET', url: `/v1/diff?indicator=${IND}&a=x&b=y` });
    expect(diffBad.statusCode).toBe(400);
    const diffNf = await app.inject({ method: 'GET', url: `/v1/diff?indicator=nope&a=${s1}&b=${s2}` });
    expect(diffNf.statusCode).toBe(404);

    // snapshots
    const snaps = await app.inject({ method: 'GET', url: '/v1/snapshots?source_id=BR-03' });
    expect(snaps.json().data.map((s: { id: string }) => s.id).sort()).toEqual([s1, s2].sort());
    const one = await app.inject({ method: 'GET', url: `/v1/snapshots/${s2}` });
    expect(one.json().data).toMatchObject({ id: s2, source_id: 'BR-03', license: 'CC-BY' });
    const nf = await app.inject({ method: 'GET', url: '/v1/snapshots/00000000-0000-0000-0000-000000000000' });
    expect(nf.statusCode).toBe(404);
    const notUuid = await app.inject({ method: 'GET', url: '/v1/snapshots/abc' });
    expect(notUuid.statusCode).toBe(404);

    // indicador agora tem publicação vigente
    const ind = await app.inject({ method: 'GET', url: `/v1/indicators/${IND}` });
    expect(ind.json().publication.snapshot_id).toBe(s2);
    expect(ind.json().freshness.data_as_of).toBe('2026-10-19');
  });
});

describe('frescor', () => {
  it('/v1/freshness devolve uma linha por indicador', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/freshness' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.generated_at).toBe('string');
    const indicators = (await app.inject({ method: 'GET', url: '/v1/indicators' })).json().data;
    expect(body.data).toHaveLength(indicators.length);
    const ids = new Set(body.data.map((r: { indicator_id: string }) => r.indicator_id));
    expect(ids.size).toBe(indicators.length);
    for (const i of indicators) expect(ids.has(i.id)).toBe(true);
  });
});

describe('rate limit', () => {
  it('responde 429 no formato de erro padrão quando habilitado', async () => {
    const limited = await buildApp({ db, rateLimit: true });
    await limited.ready();
    let last = 0;
    for (let i = 0; i < 121; i++) {
      const r = await limited.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.9' });
      last = r.statusCode;
      if (last === 429) {
        expect(r.json()).toMatchObject({ error: { code: 'rate_limited' } });
        break;
      }
    }
    expect(last).toBe(429);
    await limited.close();
  });
});
