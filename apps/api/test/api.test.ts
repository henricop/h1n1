import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb, migrate, seedAll, publishIndicator, type Db } from '@h1n1/db';
import { buildApp, parseTrustProxy, CACHE } from '../src/app.js';
import { normalizePeriodBound } from '../src/schemas.js';

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

async function insertSnapshot(sourceId: string, dataAsOf: string, status = 'ok', storagePath: string | null = null): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into snapshots (source_id, url, sha256, status, data_as_of, license, storage_path)
     values ($1,'https://x',$2,$3,$4,'CC-BY',$5) returning id::text as id`,
    [sourceId, `hash-${sourceId}-${dataAsOf}-${status}-${Math.random()}`, status, dataAsOf, storagePath],
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
  it('/health responde 200 com db pglite e Cache-Control: no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'pglite' });
    expect(typeof res.json().time).toBe('string');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rota desconhecida devolve 404 no formato de erro padrão sem ecoar a URL', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/nada?x=<script>' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    expect(res.json().error.message).not.toContain('/v1/nada');
    expect(res.json().error.message).not.toContain('<script>');
  });

  it('erros 4xx não mapeados mantêm o status original no formato padrão', async () => {
    const local = await buildApp({ db, rateLimit: false });
    local.get('/__teapot', async () => {
      throw Object.assign(new Error('sou um bule'), { statusCode: 418 });
    });
    local.get('/__forbidden', async () => {
      throw Object.assign(new Error('proibido'), { statusCode: 403 });
    });
    await local.ready();
    const teapot = await local.inject({ method: 'GET', url: '/__teapot' });
    expect(teapot.statusCode).toBe(418);
    expect(teapot.json()).toMatchObject({ error: { code: 'client_error', message: 'sou um bule' } });
    const forbidden = await local.inject({ method: 'GET', url: '/__forbidden' });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe('client_error');
    await local.close();
  });

  it('/openapi.json contém os paths do contrato e documenta as restrições', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.info).toMatchObject({ title: 'H1N1 API', version: '0.1.0' });
    expect(doc.info.description).toContain('universe_note');
    for (const p of [
      '/health', '/v1/sources', '/v1/sources/{idOrSlug}', '/v1/indicators', '/v1/indicators/{id}', '/v1/series',
      '/v1/series.csv', '/v1/freshness', '/v1/snapshots', '/v1/snapshots/{id}', '/v1/diff', '/v1/geo',
    ]) expect(doc.paths, p).toHaveProperty(p);
    expect(doc.paths['/v1/diff'].get.description).toContain("geo_level = country");
    expect(doc.paths['/v1/diff'].get.description).toContain('status = ok');
    expect(JSON.stringify(doc.paths['/v1/series'])).toContain('truncated');
    expect(JSON.stringify(doc.paths['/v1/snapshots'])).not.toContain('"storage_path"');
    const ui = await app.inject({ method: 'GET', url: '/docs' });
    expect([200, 302]).toContain(ui.statusCode);
  });

  it('CORS: GET leva Access-Control-Allow-Origin e OPTIONS preflight responde 204', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/geo?level=country', headers: { origin: 'https://exemplo.org' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://exemplo.org');
    expect(res.json().data.length).toBeGreaterThan(0);

    const pre = await app.inject({
      method: 'OPTIONS',
      url: '/v1/series',
      headers: { origin: 'https://exemplo.org', 'access-control-request-method': 'GET', 'access-control-request-headers': 'if-none-match' },
    });
    expect(pre.statusCode).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('https://exemplo.org');
    expect(String(pre.headers['access-control-allow-methods'])).toContain('GET');
    expect(pre.body).toBe('');
  });

  it('Cache-Control por rota conforme o contrato; 4xx sem cache', async () => {
    const expectCache = async (url: string, value: string) => {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode, url).toBe(200);
      expect(r.headers['cache-control'], url).toBe(value);
    };
    await expectCache('/v1/sources', CACHE.catalog);
    await expectCache('/v1/sources/BR-03', 'public, max-age=3600, stale-while-revalidate=86400');
    await expectCache('/v1/indicators', CACHE.catalog);
    await expectCache(`/v1/indicators/${IND}`, CACHE.catalog);
    await expectCache('/v1/geo', CACHE.catalog);
    await expectCache('/v1/freshness', 'public, max-age=60');
    await expectCache('/v1/snapshots', 'public, max-age=300');
    await expectCache(`/v1/series?indicator=${IND}`, 'public, max-age=300, stale-while-revalidate=3600');
    const bad = await app.inject({ method: 'GET', url: '/v1/geo?level=cidade' });
    expect(bad.statusCode).toBe(400);
    expect(bad.headers['cache-control']).toBeUndefined();
    const nf = await app.inject({ method: 'GET', url: '/v1/sources/nao-existe' });
    expect(nf.statusCode).toBe(404);
    expect(nf.headers['cache-control']).toBeUndefined();
  });

  it('/v1/series e series.csv têm ETag (hash do corpo) e respondem 304 a If-None-Match', async () => {
    const url = `/v1/series?indicator=${IND}&geo_code=WLD`;
    const first = await app.inject({ method: 'GET', url });
    expect(first.statusCode).toBe(200);
    const etag = first.headers['etag'] as string;
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    const again = await app.inject({ method: 'GET', url });
    expect(again.headers['etag']).toBe(etag); // determinístico: mesmo corpo, mesma ETag

    const notModified = await app.inject({ method: 'GET', url, headers: { 'if-none-match': etag } });
    expect(notModified.statusCode).toBe(304);
    expect(notModified.body).toBe('');
    expect(notModified.headers['etag']).toBe(etag);
    expect(notModified.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=3600');

    const weak = await app.inject({ method: 'GET', url, headers: { 'if-none-match': `W/${etag}, "outra"` } });
    expect(weak.statusCode).toBe(304);
    const star = await app.inject({ method: 'GET', url, headers: { 'if-none-match': '*' } });
    expect(star.statusCode).toBe(304);
    const miss = await app.inject({ method: 'GET', url, headers: { 'if-none-match': '"nao-bate"' } });
    expect(miss.statusCode).toBe(200);
    expect(miss.body.length).toBeGreaterThan(0);

    const other = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA` });
    expect(other.headers['etag']).toBe(etag); // sem publicação, corpos iguais → ETag igual

    const csv = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}` });
    expect(csv.statusCode).toBe(200);
    const csvEtag = csv.headers['etag'] as string;
    expect(csvEtag).toMatch(/^"[0-9a-f]{32}"$/);
    expect(csvEtag).not.toBe(etag);
    const csv304 = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}`, headers: { 'if-none-match': csvEtag } });
    expect(csv304.statusCode).toBe(304);
    expect(csv304.body).toBe('');
    // 4xx não leva ETag
    const bad = await app.inject({ method: 'GET', url: '/v1/series' });
    expect(bad.headers['etag']).toBeUndefined();
  });

  it('trustProxy é desligado por padrão e configurável (TRUST_PROXY)', async () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('0')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('1')).toBe(true);
    expect(parseTrustProxy('10.0.0.0/8, 127.0.0.1')).toBe('10.0.0.0/8, 127.0.0.1');

    const noTrust = await buildApp({ db, rateLimit: false });
    noTrust.get('/__ip', async (req) => ({ ip: req.ip }));
    await noTrust.ready();
    const a = await noTrust.inject({ method: 'GET', url: '/__ip', remoteAddress: '10.0.0.9', headers: { 'x-forwarded-for': '203.0.113.7' } });
    expect(a.json().ip).toBe('10.0.0.9');
    await noTrust.close();

    const trust = await buildApp({ db, rateLimit: false, trustProxy: true });
    trust.get('/__ip', async (req) => ({ ip: req.ip }));
    await trust.ready();
    const b = await trust.inject({ method: 'GET', url: '/__ip', remoteAddress: '10.0.0.9', headers: { 'x-forwarded-for': '203.0.113.7' } });
    expect(b.json().ip).toBe('203.0.113.7');
    await trust.close();
  });
});

describe('validação de parâmetros de texto', () => {
  it('rejeita caracteres de controle (incl. byte nulo) e tamanho > 200 com 400', async () => {
    const cases = [
      `/v1/series?indicator=${encodeURIComponent('abc\u0000def')}`,
      `/v1/series?indicator=${IND}&geo_code=${encodeURIComponent('BR\nA')}`,
      `/v1/series?indicator=${IND}&geo_code=${encodeURIComponent('BR\u001bA')}`,
      `/v1/series?indicator=${IND}&from=${encodeURIComponent('2026\u0000')}`,
      `/v1/series?indicator=${IND}&stratum.age_group=${encodeURIComponent('0-4\u0000')}`,
      `/v1/sources?country=${encodeURIComponent('B\u0000R')}`,
      `/v1/indicators?source_id=${encodeURIComponent('BR\u007f')}`,
      `/v1/snapshots?source_id=${encodeURIComponent('BR\r03')}`,
      `/v1/diff?indicator=${encodeURIComponent('x\u0000')}&a=00000000-0000-0000-0000-000000000000&b=00000000-0000-0000-0000-000000000000`,
      `/v1/sources/${encodeURIComponent('BR\u0000-03')}`,
      `/v1/indicators/${encodeURIComponent('a\u0000b')}`,
      `/v1/snapshots/${encodeURIComponent('a\u0000b')}`,
      `/v1/series?indicator=${'a'.repeat(201)}`,
      `/v1/sources?country=${'a'.repeat(201)}`,
    ];
    for (const url of cases) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode, url).toBe(400);
      expect(r.json(), url).toMatchObject({ error: { code: 'validation_error' } });
    }
    // parâmetros de caminho: até 200 caracteres passam pela validação; acima disso o roteador responde 414
    // no formato padrão e sem ecoar a URL
    for (const base of ['/v1/sources/', '/v1/indicators/', '/v1/snapshots/']) {
      const ok = await app.inject({ method: 'GET', url: base + 'a'.repeat(200) });
      expect(ok.statusCode, base).toBe(404);
      const long = await app.inject({ method: 'GET', url: base + 'a'.repeat(201) });
      expect(long.statusCode, base).toBe(414);
      expect(long.json(), base).toMatchObject({ error: { code: 'client_error' } });
      expect(long.json().error.message).not.toContain('aaaa');
    }
    const badUrl = await app.inject({ method: 'GET', url: '/v1/sources/%E0%A4%A' });
    expect(badUrl.statusCode).toBe(400);
    expect(badUrl.json()).toMatchObject({ error: { code: 'validation_error', message: 'URL inválida.' } });
  });

  it("valores de stratum.<dim> não podem conter ';' nem '='", async () => {
    for (const v of ['0-4;sex=f', 'a=b', ';', '=']) {
      const r = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&stratum.age_group=${encodeURIComponent(v)}` });
      expect(r.statusCode, v).toBe(400);
      expect(r.json().error.message).toContain('stratum.age_group');
    }
    const ok = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&stratum.age_group=65%2B` });
    expect(ok.statusCode).toBe(200);
    const badDim = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&stratum.Age=0-4` });
    expect(badDim.statusCode).toBe(400);
  });

  it('períodos: formatos aceitos, normalização de AAAA e from > to → 400', async () => {
    expect(normalizePeriodBound('2026', 'epiweek', 'from')).toBe('2026-W01');
    expect(normalizePeriodBound('2026', 'epiweek', 'to')).toBe('2026-W53');
    expect(normalizePeriodBound('2026', 'isoweek', 'to')).toBe('2026-W53');
    expect(normalizePeriodBound('2026', 'month', 'from')).toBe('2026-M01');
    expect(normalizePeriodBound('2026', 'month', 'to')).toBe('2026-M12');
    expect(normalizePeriodBound('2026', 'year', 'to')).toBe('2026');
    expect(normalizePeriodBound('2026-W10', 'epiweek', 'to')).toBe('2026-W10');

    for (const bad of ['ontem', '2026-W1', '2026-w01', '2026-M1', '26', '2026-01', '2026-W01-01', '2026-D01']) {
      const r = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=${bad}` });
      expect(r.statusCode, bad).toBe(400);
      expect(r.json().error.message).toContain('from');
    }
    for (const ok of ['2026', '2026-W01', '2026-M03']) {
      const r = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=${ok}&to=${ok}` });
      expect(r.statusCode, ok).toBe(200);
    }
    const inverted = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=2026-W10&to=2026-W05` });
    expect(inverted.statusCode).toBe(400);
    expect(inverted.json().error.message).toContain('from');
    const invertedYear = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=2027&to=2026` });
    expect(invertedYear.statusCode).toBe(400);
    // from=2026 → 2026-W01 ≤ to=2026-W10: válido
    const mixed = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=2026&to=2026-W10` });
    expect(mixed.statusCode).toBe(200);
    const mixed2 = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=2026-W10&to=2026` });
    expect(mixed2.statusCode).toBe(200);
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
    expect(body.meta.truncated).toBe(false);
    expect(typeof body.meta.universe_note).toBe('string');
    expect(body.meta.universe_note.length).toBeGreaterThan(20);

    const badLevel = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_level=city` });
    expect(badLevel.statusCode).toBe(400);
    const badPeriod = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&from=ontem` });
    expect(badPeriod.statusCode).toBe(400);
  });

  it('devolve só a snapshot vigente, com supressão e sem vazar valor bruto; CSV correto; diff restrito', async () => {
    const s1 = await insertSnapshot('BR-03', '2026-10-12', 'ok', 'data/snapshots/BR-03/s1.csv');
    const s2 = await insertSnapshot('BR-03', '2026-10-19', 'ok', 'data/snapshots/BR-03/s2.csv');
    await insertObs(s1, 'BRA', 'country', '2026-W01', 10);
    await insertObs(s1, 'BR-SP', 'state', '2026-W01', 35);
    await insertObs(s1, 'BR-SC', 'state', '2026-W01', 4);
    await insertObs(s1, 'BRA', 'country', '2026-W01', 6, '{"age_group":"0-4"}', 'age_group=0-4');
    await insertObs(s2, 'BRA', 'country', '2026-W01', 12);
    await insertObs(s2, 'BRA', 'country', '2026-W01', 8, '{"age_group":"0-4"}', 'age_group=0-4');
    await insertObs(s2, 'BR-SC', 'state', '2026-W01', 3);
    await insertObs(s2, 'BR-SC', 'state', '2026-W01', 2, '{"age_group":"0-4"}', 'age_group=0-4');
    await insertObs(s2, 'BR-SC', 'state', '2026-W01', 1, '{"age_group":"65+"}', 'age_group=65+');
    await insertObs(s2, 'BR-SP', 'state', '2026-W01', 40);
    // grupo para supressão complementar: total 40 + estratos 3 / 7 / 30
    await insertObs(s2, 'BR-RJ', 'state', '2026-W01', 40);
    await insertObs(s2, 'BR-RJ', 'state', '2026-W01', 3, '{"age_group":"0-4"}', 'age_group=0-4');
    await insertObs(s2, 'BR-RJ', 'state', '2026-W01', 7, '{"age_group":"5-14"}', 'age_group=5-14');
    await insertObs(s2, 'BR-RJ', 'state', '2026-W01', 30, '{"age_group":"15-29"}', 'age_group=15-29');

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
    expect(body.snapshot).not.toHaveProperty('storage_path');
    expect(res.body).not.toContain('storage_path');
    expect(body.publication.snapshot_id).toBe(s2);
    expect(body.meta).toMatchObject({
      data_as_of: '2026-10-19',
      license: 'CC-BY',
      suppression_threshold: 5,
      count: 1,
      truncated: false,
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

    // supressão complementar sobre o grupo completo, mesmo consultando um único estrato:
    // total 40, estratos 3 (suprimido) / 7 (complementar) / 30 → 5-14 sai suprimido
    const comp = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BR-RJ&stratum.age_group=5-14` });
    expect(comp.statusCode).toBe(200);
    expect(comp.json().observations).toHaveLength(1);
    expect(comp.json().observations[0]).toMatchObject({ geo_code: 'BR-RJ', stratum: { age_group: '5-14' }, suppressed: true, value: null });
    expect(comp.body).not.toContain('"value":7');
    const comp2 = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BR-RJ&stratum.age_group=15-29` });
    expect(comp2.json().observations[0]).toMatchObject({ value: 30, suppressed: false });
    const comp3 = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BR-RJ&stratum.age_group=0-4` });
    expect(comp3.json().observations[0]).toMatchObject({ value: null, suppressed: true });
    const compAll = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BR-RJ&include_strata=true` });
    expect(compAll.json().observations).toHaveLength(4);
    expect(compAll.json().observations.filter((o: { suppressed: boolean }) => o.suppressed)).toHaveLength(2);
    expect(compAll.body).not.toMatch(/"value":7[,}]/);
    expect(compAll.body).not.toMatch(/"value":3[,}]/);
    const compTotal = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BR-RJ` });
    expect(compTotal.json().observations).toHaveLength(1);
    expect(compTotal.json().observations[0]).toMatchObject({ value: 40, suppressed: false, stratum: {} });
    // CSV também não vaza o valor complementar
    const compCsv = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}&geo_code=BR-RJ&stratum.age_group=5-14` });
    expect(compCsv.body.trim().split('\n')).toHaveLength(2);
    expect(compCsv.body).toContain(',,,true,provisional,age_group=5-14,');
    expect(compCsv.body).not.toMatch(/,7,,false/);

    // sem include_strata só totais
    const states = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_level=state` });
    expect(states.json().observations).toHaveLength(3);
    const sp = states.json().observations.find((o: { geo_code: string }) => o.geo_code === 'BR-SP');
    expect(sp).toMatchObject({ value: 40, suppressed: false });

    // ETag muda quando a publicação muda o corpo
    const etagNow = (await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA` })).headers['etag'];
    const etagEmpty = (await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=XXX` })).headers['etag'];
    expect(etagNow).not.toBe(etagEmpty);

    // CSV
    const csv = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}&geo_level=state&geo_code=BR-SC&include_strata=true` });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toMatch(/^text\/csv/);
    expect(csv.headers['content-disposition']).toBe(`attachment; filename="${IND}.csv"`);
    expect(csv.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=3600');
    expect(csv.headers['x-truncated']).toBe('false');
    const lines = csv.body.trim().split('\n');
    expect(lines[0]).toBe(
      'indicator_id,geo_level,geo_code,period_type,period,period_start,period_end,value,denominator,suppressed,update_status,stratum_key,quality_flags,snapshot_id,data_as_of,source_id,license',
    );
    expect(lines).toHaveLength(4);
    const scTotal = lines.find((l) => l.startsWith(`${IND},state,BR-SC,epiweek,2026-W01,2026-01-04,2026-01-10,`))!;
    expect(scTotal).toBe(`${IND},state,BR-SC,epiweek,2026-W01,2026-01-04,2026-01-10,,,true,provisional,,,${s2},2026-10-19,BR-03,CC-BY`);
    expect(csv.body).not.toMatch(/,3,,true/);
    const csvSp = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}&geo_code=BR-SP` });
    expect(csvSp.body.split('\n').find((l) => l.includes(',BR-SP,'))).toContain(',40,,false,provisional,');

    // diff entre snapshots: só país sem estrato; nada subnacional ou estratificado sai
    const diff = await app.inject({ method: 'GET', url: `/v1/diff?indicator=${IND}&a=${s1}&b=${s2}` });
    expect(diff.statusCode).toBe(200);
    expect(diff.headers['cache-control']).toBe('public, max-age=300');
    expect(diff.json().data).toHaveLength(1);
    expect(diff.json().data[0]).toMatchObject({ geo_level: 'country', geo_code: 'BRA', stratum_key: '', value_a: 10, value_b: 12 });
    expect(diff.body).not.toContain('BR-SP');
    expect(diff.body).not.toContain('BR-SC');
    expect(diff.body).not.toContain('age_group');
    const diffBad = await app.inject({ method: 'GET', url: `/v1/diff?indicator=${IND}&a=x&b=y` });
    expect(diffBad.statusCode).toBe(400);
    const diffNf = await app.inject({ method: 'GET', url: `/v1/diff?indicator=nope&a=${s1}&b=${s2}` });
    expect(diffNf.statusCode).toBe(404);
    const missing = '00000000-0000-0000-0000-000000000000';
    const diffSnapNf = await app.inject({ method: 'GET', url: `/v1/diff?indicator=${IND}&a=${s1}&b=${missing}` });
    expect(diffSnapNf.statusCode).toBe(404);
    expect(diffSnapNf.json().error.message).toContain('b');
    const failed = await insertSnapshot('BR-03', '2026-10-20', 'failed');
    const quarantined = await insertSnapshot('BR-03', '2026-10-21', 'quarantined');
    for (const bad of [failed, quarantined]) {
      const r = await app.inject({ method: 'GET', url: `/v1/diff?indicator=${IND}&a=${s1}&b=${bad}` });
      expect(r.statusCode).toBe(400);
      expect(r.json()).toMatchObject({ error: { code: 'validation_error' } });
      expect(r.json().error.message).toContain("'ok'");
    }
    const otherSource = await insertSnapshot('INT-01', '2026-10-19');
    const diffOther = await app.inject({ method: 'GET', url: `/v1/diff?indicator=${IND}&a=${s1}&b=${otherSource}` });
    expect(diffOther.statusCode).toBe(400);
    expect(diffOther.json().error.message).toContain('fonte');

    // snapshots: storage_path nunca sai
    const snaps = await app.inject({ method: 'GET', url: '/v1/snapshots?source_id=BR-03' });
    expect(snaps.headers['cache-control']).toBe('public, max-age=300');
    const ids = snaps.json().data.map((s: { id: string }) => s.id);
    expect(ids).toContain(s1);
    expect(ids).toContain(s2);
    expect(snaps.body).not.toContain('storage_path');
    expect(snaps.body).not.toContain('data/snapshots');
    const one = await app.inject({ method: 'GET', url: `/v1/snapshots/${s2}` });
    expect(one.json().data).toMatchObject({ id: s2, source_id: 'BR-03', license: 'CC-BY', status: 'ok' });
    expect(one.json().data).not.toHaveProperty('storage_path');
    expect(one.body).not.toContain('data/snapshots');
    const nf = await app.inject({ method: 'GET', url: `/v1/snapshots/${missing}` });
    expect(nf.statusCode).toBe(404);
    const notUuid = await app.inject({ method: 'GET', url: '/v1/snapshots/abc' });
    expect(notUuid.statusCode).toBe(404);

    // indicador agora tem publicação vigente
    const ind = await app.inject({ method: 'GET', url: `/v1/indicators/${IND}` });
    expect(ind.json().publication.snapshot_id).toBe(s2);
    expect(ind.json().freshness.data_as_of).toBe('2026-10-19');
  });

  it('meta.truncated / X-Truncated quando o número de observações atinge limit; to=AAAA cobre o ano inteiro', async () => {
    const snap = await insertSnapshot('BR-03', '2026-10-22');
    for (const [period, value] of [['2026-W02', 11], ['2026-W03', 12], ['2026-W04', 13], ['2026-W53', 14]] as const) {
      await insertObs(snap, 'BRA', 'country', period, value);
    }
    await insertObs(snap, 'BRA', 'country', '2026-W02', 5, '{"age_group":"0-4"}', 'age_group=0-4');
    await insertObs(snap, 'BRA', 'country', '2026-W02', 6, '{"age_group":"65+"}', 'age_group=65+');
    await publishIndicator(db, { indicatorId: IND, snapshotId: snap, dataAsOf: '2026-10-22' });

    const cut = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&limit=2` });
    expect(cut.statusCode).toBe(200);
    expect(cut.json().observations).toHaveLength(2);
    expect(cut.json().meta).toMatchObject({ count: 2, truncated: true });
    const full = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&limit=100` });
    expect(full.json().observations).toHaveLength(4);
    expect(full.json().meta.truncated).toBe(false);

    // com estratos o corte é aplicado depois da supressão sobre o grupo completo
    const cutStrata = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&include_strata=true&limit=2` });
    expect(cutStrata.json().observations).toHaveLength(2);
    expect(cutStrata.json().meta.truncated).toBe(true);
    const fullStrata = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&include_strata=true` });
    expect(fullStrata.json().observations).toHaveLength(6);
    expect(fullStrata.json().meta.truncated).toBe(false);

    const csvCut = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}&geo_code=BRA&limit=2` });
    expect(csvCut.headers['x-truncated']).toBe('true');
    expect(csvCut.body.trim().split('\n')).toHaveLength(3);
    const csvFull = await app.inject({ method: 'GET', url: `/v1/series.csv?indicator=${IND}&geo_code=BRA` });
    expect(csvFull.headers['x-truncated']).toBe('false');

    // to=2026 → 2026-W53 (inclui a última semana); from=2026 → 2026-W01
    const year = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&from=2026&to=2026` });
    expect(year.json().observations.map((o: { period: string }) => o.period)).toEqual(['2026-W02', '2026-W03', '2026-W04', '2026-W53']);
    const toYear = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&from=2026-W04&to=2026` });
    expect(toYear.json().observations.map((o: { period: string }) => o.period)).toEqual(['2026-W04', '2026-W53']);
    const nextYear = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&from=2027` });
    expect(nextYear.json().observations).toEqual([]);
    const upTo = await app.inject({ method: 'GET', url: `/v1/series?indicator=${IND}&geo_code=BRA&to=2026-W03` });
    expect(upTo.json().observations.map((o: { period: string }) => o.period)).toEqual(['2026-W02', '2026-W03']);
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
  it('responde 429 no formato de erro padrão com cabeçalhos RateLimit-* (draft)', async () => {
    const limited = await buildApp({ db, rateLimit: true });
    await limited.ready();
    const first = await limited.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.9' });
    expect(first.statusCode).toBe(200);
    expect(first.headers['ratelimit-limit']).toBe('120');
    expect(first.headers['ratelimit-remaining']).toBe('119');
    expect(first.headers['ratelimit-reset']).toBeDefined();
    expect(first.headers['x-ratelimit-limit']).toBeUndefined();
    let last = 0;
    let body: { error: { code: string; message: string } } | null = null;
    let headers: Record<string, unknown> = {};
    for (let i = 0; i < 121; i++) {
      const r = await limited.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.9' });
      last = r.statusCode;
      if (last === 429) { body = r.json(); headers = r.headers; break; }
    }
    expect(last).toBe(429);
    expect(body).toMatchObject({ error: { code: 'rate_limited' } });
    expect(body!.error.message).toContain('120');
    expect(headers['ratelimit-limit']).toBe('120');
    expect(headers['ratelimit-remaining']).toBe('0');
    expect(headers['retry-after']).toBeDefined();
    // outro IP continua servido
    const other = await limited.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.10' });
    expect(other.statusCode).toBe(200);
    await limited.close();
  });

  it('/v1/series.csv tem limite próprio (20/min por padrão, configurável) separado do JSON', async () => {
    const limited = await buildApp({ db, rateLimit: true, csvRateLimitMax: 3 });
    await limited.ready();
    const url = `/v1/series.csv?indicator=${IND}`;
    for (let i = 0; i < 3; i++) {
      const r = await limited.inject({ method: 'GET', url, remoteAddress: '10.0.0.20' });
      expect(r.statusCode).toBe(200);
      expect(r.headers['ratelimit-limit']).toBe('3');
    }
    const blocked = await limited.inject({ method: 'GET', url, remoteAddress: '10.0.0.20' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ error: { code: 'rate_limited' } });
    expect(blocked.json().error.message).toContain('3');
    // o JSON do mesmo IP segue no limite global (120)
    const json = await limited.inject({ method: 'GET', url: `/v1/series?indicator=${IND}`, remoteAddress: '10.0.0.20' });
    expect(json.statusCode).toBe(200);
    expect(json.headers['ratelimit-limit']).toBe('120');
    await limited.close();

    const defaults = await buildApp({ db, rateLimit: true });
    await defaults.ready();
    const r = await defaults.inject({ method: 'GET', url, remoteAddress: '10.0.0.21' });
    expect(r.headers['ratelimit-limit']).toBe('20');
    await defaults.close();

    // desligável: csvRateLimitMax=0 usa o limite global
    const off = await buildApp({ db, rateLimit: true, csvRateLimitMax: 0 });
    await off.ready();
    const r2 = await off.inject({ method: 'GET', url, remoteAddress: '10.0.0.22' });
    expect(r2.headers['ratelimit-limit']).toBe('120');
    await off.close();
  });
});
