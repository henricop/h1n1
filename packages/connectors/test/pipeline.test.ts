import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb, migrate, seedAll, getSeries, type Db } from '@h1n1/db';
import type { Observation } from '@h1n1/core';
import { runConnector, NOTE_PROCESSING, RAW_DELETED_REASON } from '../src/pipeline.js';
import { sha256Hex } from '../src/http.js';
import { makeObs } from '../src/util.js';
import type { Connector, NormalizeContext, RawSnapshot } from '../src/types.js';

let db: Db;
let root: string;
beforeAll(async () => {
  db = await createDb({ databaseUrl: null, pgliteDir: 'memory://' });
  await migrate(db);
  await seedAll(db);
  root = mkdtempSync(join(tmpdir(), 'h1n1-snap-'));
});
afterAll(async () => { await db.close(); rmSync(root, { recursive: true, force: true }); });

interface FakeRow { period: string; value: number; geo?: string }
const IND = 'flunet_ah1n1pdm09_detections';
const IND_B = 'flunet_ah3_detections';
const IND_C = 'flunet_inf_b_detections';
const IND_D = 'flunet_specimens_processed';

interface FakeOpts {
  coverage?: [string, string];
  dataAsOf?: string;
  indicators?: string[];
  retainRaw?: boolean;
  errors?: string[];
  onNormalize?: (ctx: NormalizeContext) => Promise<void>;
}

/** Conector fake: "baixa" um JSON controlado pelo teste e normaliza para indicadores FluNet de contagem. */
function fake(rows: FakeRow[], opts: FakeOpts = {}): Connector {
  const indicators = opts.indicators ?? [IND];
  return {
    id: 'fake', sourceId: 'INT-01', indicators, retainRaw: opts.retainRaw,
    async fetch(ctx): Promise<RawSnapshot> {
      const body = JSON.stringify(rows);
      const path = join(ctx.tmpDir, `fake_${Date.now()}_${Math.random()}.json`);
      await writeFile(path, body);
      return { url: 'https://example.test/fake', urls: ['https://example.test/fake'], path, ext: 'json', sha256: sha256Hex(body), bytes: body.length,
        content_type: 'application/json', license: 'teste', data_as_of: opts.dataAsOf ?? '2026-10-11', fetched_at: new Date().toISOString() };
    },
    async normalize(raw, ctx): Promise<Observation[]> {
      const data = JSON.parse(readFileSync(raw.path, 'utf8')) as FakeRow[];
      ctx.countRowsIn(data.length);
      for (const id of indicators) if (opts.coverage) ctx.setCoverage(id, opts.coverage[0], opts.coverage[1]);
      for (const e of opts.errors ?? []) ctx.addError(e);
      if (opts.onNormalize) await opts.onNormalize(ctx);
      return indicators.flatMap((id) => data.map((r) => makeObs({ indicator_id: id, snapshot_id: ctx.snapshotId, geo_level: 'country', geo_code: r.geo ?? 'BRA', period_type: 'isoweek', period: r.period, value: r.value })));
    },
  };
}
const weeks = (n: number, v = 5) => Array.from({ length: n }, (_, i) => ({ period: `2026-W${String(i + 1).padStart(2, '0')}`, value: v }));
const log = () => {};

/** Db que lança na n-ésima query cujo SQL casa com o padrão (também dentro de transações). */
function faulty(inner: Db, pattern: RegExp, nth: number): Db {
  let n = 0;
  const wrap = (d: Db): Db => ({
    kind: d.kind,
    async query(sql, params) {
      if (pattern.test(sql) && ++n === nth) throw new Error('falha simulada no meio da publicação');
      return d.query(sql, params);
    },
    exec: (sql) => d.exec(sql),
    transaction: (fn) => d.transaction((tx) => fn(wrap(tx))),
    close: () => d.close(),
  });
  return wrap(inner);
}

const snapshotRow = (id: string) => db.query<{ status: string; notes: string | null; storage_path: string | null }>('select status, notes, storage_path from snapshots where id = $1', [id]).then((r) => r.rows[0]!);
const publications = (snapshotId: string) => db.query<{ indicator_id: string; status: string }>('select indicator_id, status from indicator_publications where snapshot_id = $1 order by indicator_id', [snapshotId]).then((r) => r.rows);
const current = (indicator: string) => db.query<{ snapshot_id: string; data_as_of: string | null }>(`select snapshot_id::text as snapshot_id, data_as_of::text as data_as_of from indicator_publications where indicator_id = $1 and status = 'current'`, [indicator]).then((r) => r.rows[0] ?? null);

describe('pipeline fim a fim (PGlite memory://)', () => {
  it('publica, grava snapshot com sidecar e fecha ingestion_run', async () => {
    const r = await runConnector(fake(weeks(10)), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('ok');
    expect(r.partial).toBe(false);
    expect(r.rawFileDeleted).toBe(false);
    expect(r.rowsIn).toBe(10);
    expect(r.rowsOut).toBe(10);
    expect(r.publishedIndicators).toEqual([IND]);
    const files = readdirSync(join(root, 'who_flunet'));
    expect(files.some((f) => /^\d{8}T\d{6}_[0-9a-f]{12}\.json$/.test(f))).toBe(true);
    const meta = files.find((f) => f.endsWith('.meta.json'))!;
    const m = JSON.parse(readFileSync(join(root, 'who_flunet', meta), 'utf8'));
    expect(m).toMatchObject({ url: 'https://example.test/fake', sha256: r.sha256, license: 'teste', data_as_of: '2026-10-11', retain_raw: true, raw_file_deleted: false });
    expect(m.fetched_at).toBeTruthy();
    const s = await getSeries(db, { indicator: IND, geoCode: 'BRA' });
    expect(s!.observations).toHaveLength(10);
    expect(s!.meta.data_as_of).toBe('2026-10-11');
    expect((await snapshotRow(r.snapshotId!)).status).toBe('ok');
    const run = await db.query<{ status: string; rows_out: string }>(`select status, rows_out::text as rows_out from ingestion_runs order by id desc limit 1`);
    expect(run.rows[0]).toMatchObject({ status: 'ok', rows_out: '10' });
  });

  it('snapshot nasce em quarentena ("em processamento") e só vira ok ao publicar', async () => {
    let seen: { status: string; notes: string | null } | null = null;
    const c = fake(weeks(10, 6), { onNormalize: async (ctx) => { seen = await snapshotRow(ctx.snapshotId); } });
    const r = await runConnector(c, { force: true }, { db, snapshotRoot: root, log });
    expect(r.status).toBe('ok');
    expect(seen).toMatchObject({ status: 'quarantined', notes: NOTE_PROCESSING });
    expect((await snapshotRow(r.snapshotId!))).toMatchObject({ status: 'ok' });
  });

  it('reingestão idêntica é no-op (sem mudança)', async () => {
    const before = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    const r = await runConnector(fake(weeks(10, 6)), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('unchanged');
    expect(r.storagePath).toBeNull();
    const after = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    expect(after).toBe(before);
    const forced = await runConnector(fake(weeks(10, 6)), { force: true }, { db, snapshotRoot: root, log });
    expect(forced.status).toBe('ok');
  });

  it('snapshot inválida (valor negativo) vai para quarentena e a anterior continua vigente', async () => {
    const rows = weeks(10);
    rows[3]!.value = -2;
    const r = await runConnector(fake(rows), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('quarantined');
    expect(r.rejectedIndicators).toEqual([IND]);
    expect((await snapshotRow(r.snapshotId!)).status).toBe('quarantined');
    const s = await getSeries(db, { indicator: IND, geoCode: 'BRA' });
    expect(s!.publication!.snapshot_id).not.toBe(r.snapshotId);
    expect(s!.observations.every((o) => o.value === 6)).toBe(true);
    const run = await db.query<{ status: string }>(`select status from ingestion_runs order by id desc limit 1`);
    expect(run.rows[0]!.status).toBe('quarantined');
    expect(existsSync(r.storagePath!)).toBe(true);
  });

  it('erro reportado pelo conector (addError, ex.: duplicatas) também é quarentena', async () => {
    const r = await runConnector(fake(weeks(10, 6), { errors: ['3 linha(s) duplicada(s)'] }), { force: true }, { db, snapshotRoot: root, log });
    expect(r.status).toBe('quarantined');
    expect(String(r.validation.errors)).toMatch(/conector: 3 linha/);
    expect((await snapshotRow(r.snapshotId!)).notes).toMatch(/duplicada/);
  });

  it('queda abrupta de observações (< 90%) também é quarentena', async () => {
    const r = await runConnector(fake(weeks(8)), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('quarantined');
    expect(String(r.validation.errors)).toMatch(/queda abrupta/);
  });

  it('crescimento é publicado; carry-forward mantém períodos fora da cobertura', async () => {
    const r = await runConnector(fake(weeks(12, 7)), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('ok');
    // nova snapshot cobre só 2027-W01..W53: as 12 semanas de 2026 devem ser carregadas adiante
    const r2 = await runConnector(fake([{ period: '2027-W01', value: 1 }, { period: '2027-W02', value: 2 }], { coverage: ['2027-W01', '2027-W53'], dataAsOf: '2027-01-17' }), {}, { db, snapshotRoot: root, log });
    expect(r2.status).toBe('ok');
    const s = await getSeries(db, { indicator: IND, geoCode: 'BRA' });
    expect(s!.observations).toHaveLength(14);
    expect(s!.meta.data_as_of).toBe('2027-01-17');
    const carried = s!.observations.find((o) => o.period === '2026-W05')!;
    expect(carried.value).toBe(7);
    expect(carried.quality_flags).toContain('carried_forward');
  });

  it('carga retroativa não rebaixa data_as_of: publicação fica com o máximo entre a nova e a vigente', async () => {
    // reprocessa só 2026 (cobertura 2026) com data_as_of anterior à vigente (2027-01-17)
    const r = await runConnector(fake(weeks(12, 8), { coverage: ['2026-W01', '2026-W53'], dataAsOf: '2026-12-01' }), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('ok');
    expect(r.dataAsOf).toBe('2027-01-17');
    const s = await getSeries(db, { indicator: IND, geoCode: 'BRA' });
    expect(s!.meta.data_as_of).toBe('2027-01-17');
    expect(s!.observations.find((o) => o.period === '2026-W05')!.value).toBe(8);
    expect(s!.observations.find((o) => o.period === '2027-W02')!.quality_flags).toContain('carried_forward');
    // nova data posterior avança normalmente
    const r2 = await runConnector(fake(weeks(12, 9), { coverage: ['2026-W01', '2026-W53'], dataAsOf: '2027-02-01' }), {}, { db, snapshotRoot: root, log });
    expect(r2.dataAsOf).toBe('2027-02-01');
    expect((await current(IND))!.data_as_of).toBe('2027-02-01');
  });

  it('dry-run não grava nada', async () => {
    const before = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    const r = await runConnector(fake(weeks(20)), { dryRun: true }, { db, snapshotRoot: root, log });
    expect(r.status).toBe('dry-run');
    const after = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    expect(after).toBe(before);
  });

  it('--max-rows: execução parcial fica em quarentena, não publica e não bloqueia a reingestão completa', async () => {
    const full = await runConnector(fake(weeks(10, 11), { indicators: [IND_C] }), {}, { db, snapshotRoot: root, log });
    expect(full.status).toBe('ok');
    const logs: string[] = [];
    const rows = weeks(10, 12);
    const partial = await runConnector(fake(rows, { indicators: [IND_C] }), { maxRows: 5 }, { db, snapshotRoot: root, log: (m) => logs.push(m) });
    expect(partial.status).toBe('quarantined');
    expect(partial.partial).toBe(true);
    expect(partial.publishedIndicators).toEqual([]);
    expect(await snapshotRow(partial.snapshotId!)).toMatchObject({ status: 'quarantined', notes: 'execução parcial (max-rows=5); não publicável' });
    expect(await publications(partial.snapshotId!)).toEqual([]);
    expect((await current(IND_C))!.snapshot_id).toBe(full.snapshotId);
    expect(logs.join('\n')).toMatch(/AVISO.*max-rows=5/);
    expect(logs.join('\n')).toMatch(/NÃO será publicada|NÃO publicada/);
    const run = await db.query<{ status: string; error: string | null }>(`select status, error from ingestion_runs order by id desc limit 1`);
    expect(run.rows[0]!.status).toBe('quarantined');
    expect(run.rows[0]!.error).toMatch(/execução parcial/);
    // mesmo sha256, agora completo: a parcial não conta como snapshot ok idempotente
    const again = await runConnector(fake(rows, { indicators: [IND_C] }), {}, { db, snapshotRoot: root, log });
    expect(again.status).toBe('ok');
    expect(again.sha256).toBe(partial.sha256);
    expect((await current(IND_C))!.snapshot_id).toBe(again.snapshotId);
    // SIVEP_MAX_ROWS (env) tem o mesmo efeito
    process.env.SIVEP_MAX_ROWS = '3';
    try {
      const env = await runConnector(fake(weeks(10, 13), { indicators: [IND_C] }), {}, { db, snapshotRoot: root, log });
      expect(env.status).toBe('quarantined');
      expect(env.partial).toBe(true);
      expect((await snapshotRow(env.snapshotId!)).notes).toMatch(/max-rows=3/);
    } finally {
      delete process.env.SIVEP_MAX_ROWS;
    }
    expect((await current(IND_C))!.snapshot_id).toBe(again.snapshotId);
  });

  it('retainRaw: false apaga o bruto após a normalização, mantém o sidecar e zera storage_path', async () => {
    const r = await runConnector(fake(weeks(10, 14), { indicators: [IND_D], retainRaw: false }), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('ok');
    expect(r.rawFileDeleted).toBe(true);
    expect(r.storagePath).toBeNull();
    const files = readdirSync(join(root, 'who_flunet'));
    const metaName = files.find((f) => f.includes(r.sha256.slice(0, 12)) && f.endsWith('.meta.json'))!;
    expect(metaName).toBeTruthy();
    expect(files.find((f) => f.includes(r.sha256.slice(0, 12)) && !f.endsWith('.meta.json'))).toBeUndefined();
    const m = JSON.parse(readFileSync(join(root, 'who_flunet', metaName), 'utf8'));
    expect(m).toMatchObject({ sha256: r.sha256, bytes: expect.any(Number), url: 'https://example.test/fake', license: 'teste', retain_raw: false, raw_file_deleted: true, raw_file_deleted_reason: RAW_DELETED_REASON, storage_path: null });
    expect(m.fetched_at).toBeTruthy();
    expect(await snapshotRow(r.snapshotId!)).toMatchObject({ status: 'ok', storage_path: null });
    // também em quarentena (valor negativo) e em falha o bruto não fica
    const rows = weeks(10, 15); rows[2]!.value = -1;
    const q = await runConnector(fake(rows, { indicators: [IND_D], retainRaw: false }), {}, { db, snapshotRoot: root, log });
    expect(q.status).toBe('quarantined');
    expect(q.rawFileDeleted).toBe(true);
    expect(readdirSync(join(root, 'who_flunet')).filter((f) => f.includes(q.sha256.slice(0, 12)))).toEqual([expect.stringMatching(/\.meta\.json$/)]);
    const boom = fake(weeks(10, 16), { indicators: [IND_D], retainRaw: false, onNormalize: async () => { throw new Error('explodiu'); } });
    const f = await runConnector(boom, {}, { db, snapshotRoot: root, log });
    expect(f.status).toBe('failed');
    expect(f.rawFileDeleted).toBe(true);
    expect(readdirSync(join(root, 'who_flunet')).filter((x) => x.includes(f.sha256.slice(0, 12)))).toEqual([expect.stringMatching(/\.meta\.json$/)]);
    expect(await snapshotRow(f.snapshotId!)).toMatchObject({ status: 'failed', storage_path: null });
  });

  it('interrupção no meio da publicação: tudo revertido, publicação anterior vigente, snapshot failed', async () => {
    const first = await runConnector(fake(weeks(10, 17), { indicators: [IND_B, IND_C] }), { force: true }, { db, snapshotRoot: root, log });
    expect(first.status).toBe('ok');
    const prevB = (await current(IND_B))!;
    const prevC = (await current(IND_C))!;
    expect(prevB.snapshot_id).toBe(first.snapshotId);
    // a 2ª inserção em indicator_publications (IND_C) falha: a de IND_B já tinha "acontecido" na mesma transação
    const bad = faulty(db, /insert into indicator_publications/i, 2);
    const r = await runConnector(fake(weeks(10, 18), { indicators: [IND_B, IND_C] }), { force: true }, { db: bad, snapshotRoot: root, log });
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/falha simulada/);
    expect(r.publishedIndicators).toEqual([]);
    expect(await publications(r.snapshotId!)).toEqual([]);
    expect(await snapshotRow(r.snapshotId!)).toMatchObject({ status: 'failed' });
    expect((await current(IND_B))!.snapshot_id).toBe(first.snapshotId);
    expect((await current(IND_C))!.snapshot_id).toBe(first.snapshotId);
    const superseded = await db.query<{ n: string }>(`select count(*)::text as n from indicator_publications where snapshot_id = $1 and status = 'superseded'`, [first.snapshotId]);
    expect(superseded.rows[0]!.n).toBe('0');
    const s = await getSeries(db, { indicator: IND_B, geoCode: 'BRA' });
    expect(s!.observations.every((o) => o.value === 17)).toBe(true);
    const run = await db.query<{ status: string }>(`select status from ingestion_runs order by id desc limit 1`);
    expect(run.rows[0]!.status).toBe('failed');
    // a mesma carga sem falha publica normalmente (a snapshot 'failed' não bloqueia)
    const ok = await runConnector(fake(weeks(10, 18), { indicators: [IND_B, IND_C] }), {}, { db, snapshotRoot: root, log });
    expect(ok.status).toBe('ok');
    expect((await current(IND_C))!.snapshot_id).toBe(ok.snapshotId);
  });

  it('normalize em streaming (AsyncIterable): lotes por país, geo nova garantida durante o fluxo e aceita pela validação', async () => {
    const stream: Connector = {
      id: 'fake-stream', sourceId: 'INT-01', indicators: [IND_D],
      async fetch(ctx): Promise<RawSnapshot> {
        const body = 'stream-' + Math.random();
        const path = join(ctx.tmpDir, `stream_${Date.now()}.ndjson`);
        await writeFile(path, body);
        return { url: 'https://example.test/stream', urls: ['https://example.test/stream'], path, ext: 'ndjson', sha256: sha256Hex(body), bytes: body.length,
          content_type: 'application/x-ndjson', license: 'teste', data_as_of: '2026-10-11', fetched_at: new Date().toISOString() };
      },
      async *normalize(_raw, ctx): AsyncIterable<Observation[]> {
        for (const geo of ['BRA', 'ZZQ']) {
          // país que não existe na tabela geo chega no meio do fluxo
          ctx.ensureGeo([{ code: geo, level: 'country', name: geo === 'ZZQ' ? 'Zedônia' : 'Brasil', parent_code: 'WLD' }]);
          yield weeks(5, 3).map((r) => makeObs({ indicator_id: IND_D, snapshot_id: ctx.snapshotId, geo_level: 'country', geo_code: geo, period_type: 'isoweek', period: r.period, value: r.value }));
          ctx.countRowsIn(5);
        }
      },
    };
    const r = await runConnector(stream, { force: true }, { db, snapshotRoot: root, log });
    expect(r.status).toBe('ok');
    expect(r.rowsIn).toBe(10);
    expect(r.rowsOut).toBe(10);
    const g = await db.query<{ name: string; level: string }>(`select name, level from geo where code = 'ZZQ'`);
    expect(g.rows[0]).toEqual({ name: 'Zedônia', level: 'country' });
    const s = await getSeries(db, { indicator: IND_D, geoCode: 'ZZQ' });
    expect(s!.observations).toHaveLength(5);
  });

  it('carry-forward com period_type year (sivep_reporting_delay_cdf): ano fora da cobertura é mantido da publicação vigente', async () => {
    const DELAY = 'sivep_reporting_delay_cdf';
    const cdfConnector = (period: string, values: number[], dataAsOf: string): Connector => ({
      id: 'fake-cdf', sourceId: 'BR-03', indicators: [DELAY],
      async fetch(ctx): Promise<RawSnapshot> {
        const body = JSON.stringify({ period, values });
        const path = join(ctx.tmpDir, `cdf_${Date.now()}.json`);
        await writeFile(path, body);
        return { url: 'https://example.test/cdf', urls: ['https://example.test/cdf'], path, ext: 'json', sha256: sha256Hex(body), bytes: body.length,
          content_type: 'application/json', license: 'teste', data_as_of: dataAsOf, fetched_at: new Date().toISOString() };
      },
      async normalize(_raw, ctx): Promise<Observation[]> {
        ctx.countRowsIn(values.length);
        ctx.setCoverage(DELAY, period, period);
        return values.map((v, d) => makeObs({ indicator_id: DELAY, snapshot_id: ctx.snapshotId, geo_level: 'country', geo_code: 'BRA', period_type: 'year', period, value: v, denominator: 500, stratum: { delay_weeks: String(d) } }));
      },
    });
    const vals2025 = [10, 30, 50, 60, 70, 80, 85, 90, 95, 97, 98, 99, 100];
    const r1 = await runConnector(cdfConnector('2025', vals2025, '2025-12-20'), {}, { db, snapshotRoot: root, log });
    expect(r1.status).toBe('ok');
    const vals2026 = [20, 40, 55, 65, 75, 82, 88, 92, 96, 98, 99, 99.5, 100];
    const r2 = await runConnector(cdfConnector('2026', vals2026, '2026-10-19'), {}, { db, snapshotRoot: root, log });
    expect(r2.status).toBe('ok');
    expect(r2.rowsOut).toBe(26); // 13 novas + 13 carregadas adiante
    const rows = await db.query<{ period: string; d: string; value: string; flags: string[] }>(
      `select period, stratum->>'delay_weeks' as d, value::text as value, quality_flags as flags from observations
        where indicator_id = $1 and snapshot_id = $2::uuid order by period, (stratum->>'delay_weeks')::int`, [DELAY, r2.snapshotId]);
    expect(rows.rows).toHaveLength(26);
    expect(rows.rows.filter((x) => x.period === '2025').every((x) => x.flags.includes('carried_forward'))).toBe(true);
    expect(rows.rows.filter((x) => x.period === '2026').every((x) => !x.flags.includes('carried_forward'))).toBe(true);
    expect(Number(rows.rows.find((x) => x.period === '2025' && x.d === '0')!.value)).toBe(10);
    expect(Number(rows.rows.find((x) => x.period === '2026' && x.d === '0')!.value)).toBe(20);
    expect((await current(DELAY))!.data_as_of).toBe('2026-10-19');
    // reprocessar 2026 com valores novos sobrescreve 2026 e continua carregando 2025 adiante
    const r3 = await runConnector(cdfConnector('2026', vals2026.map((v) => Math.min(100, v + 1)), '2026-10-26'), {}, { db, snapshotRoot: root, log });
    expect(r3.status).toBe('ok');
    const again = await db.query<{ period: string; n: string }>(`select period, count(*)::text as n from observations where indicator_id = $1 and snapshot_id = $2::uuid group by period order by period`, [DELAY, r3.snapshotId]);
    expect(again.rows).toEqual([{ period: '2025', n: '13' }, { period: '2026', n: '13' }]);
    // CDF não monotônica → quarentena, vigente permanece
    const bad = await runConnector(cdfConnector('2026', [50, 40, ...vals2026.slice(2)], '2026-11-02'), {}, { db, snapshotRoot: root, log });
    expect(bad.status).toBe('quarantined');
    expect(String(bad.validation.errors)).toMatch(/delay_cdf não decrescente/);
    expect((await current(DELAY))!.snapshot_id).toBe(r3.snapshotId);
  });
});
