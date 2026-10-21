import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb, migrate, seedAll, getSeries, type Db } from '@h1n1/db';
import type { Observation } from '@h1n1/core';
import { runConnector } from '../src/pipeline.js';
import { sha256Hex } from '../src/http.js';
import { makeObs } from '../src/util.js';
import type { Connector, RawSnapshot } from '../src/types.js';

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

/** Conector fake: "baixa" um JSON controlado pelo teste e normaliza para o indicador FluNet H1N1. */
function fake(rows: FakeRow[], opts: { coverage?: [string, string]; dataAsOf?: string } = {}): Connector {
  return {
    id: 'fake', sourceId: 'INT-01', indicators: [IND],
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
      if (opts.coverage) ctx.setCoverage(IND, opts.coverage[0], opts.coverage[1]);
      return data.map((r) => makeObs({ indicator_id: IND, snapshot_id: ctx.snapshotId, geo_level: 'country', geo_code: r.geo ?? 'BRA', period_type: 'isoweek', period: r.period, value: r.value }));
    },
  };
}
const weeks = (n: number, v = 5) => Array.from({ length: n }, (_, i) => ({ period: `2026-W${String(i + 1).padStart(2, '0')}`, value: v }));
const log = () => {};

describe('pipeline fim a fim (PGlite memory://)', () => {
  it('publica, grava snapshot com sidecar e fecha ingestion_run', async () => {
    const r = await runConnector(fake(weeks(10)), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('ok');
    expect(r.rowsIn).toBe(10);
    expect(r.rowsOut).toBe(10);
    expect(r.publishedIndicators).toEqual([IND]);
    const files = readdirSync(join(root, 'who_flunet'));
    expect(files.some((f) => /^\d{8}T\d{6}_[0-9a-f]{12}\.json$/.test(f))).toBe(true);
    const meta = files.find((f) => f.endsWith('.meta.json'))!;
    const m = JSON.parse(readFileSync(join(root, 'who_flunet', meta), 'utf8'));
    expect(m).toMatchObject({ url: 'https://example.test/fake', sha256: r.sha256, license: 'teste', data_as_of: '2026-10-11' });
    expect(m.fetched_at).toBeTruthy();
    const s = await getSeries(db, { indicator: IND, geoCode: 'BRA' });
    expect(s!.observations).toHaveLength(10);
    expect(s!.meta.data_as_of).toBe('2026-10-11');
    const run = await db.query<{ status: string; rows_out: string }>(`select status, rows_out::text as rows_out from ingestion_runs order by id desc limit 1`);
    expect(run.rows[0]).toMatchObject({ status: 'ok', rows_out: '10' });
  });

  it('reingestão idêntica é no-op (sem mudança)', async () => {
    const before = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    const r = await runConnector(fake(weeks(10)), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('unchanged');
    expect(r.storagePath).toBeNull();
    const after = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    expect(after).toBe(before);
    const forced = await runConnector(fake(weeks(10)), { force: true }, { db, snapshotRoot: root, log });
    expect(forced.status).toBe('ok');
  });

  it('snapshot inválida (valor negativo) vai para quarentena e a anterior continua vigente', async () => {
    const rows = weeks(10);
    rows[3]!.value = -2;
    const r = await runConnector(fake(rows), {}, { db, snapshotRoot: root, log });
    expect(r.status).toBe('quarantined');
    expect(r.rejectedIndicators).toEqual([IND]);
    const snap = await db.query<{ status: string }>('select status from snapshots where id = $1', [r.snapshotId]);
    expect(snap.rows[0]!.status).toBe('quarantined');
    const s = await getSeries(db, { indicator: IND, geoCode: 'BRA' });
    expect(s!.publication!.snapshot_id).not.toBe(r.snapshotId);
    expect(s!.observations.every((o) => o.value === 5)).toBe(true);
    const run = await db.query<{ status: string }>(`select status from ingestion_runs order by id desc limit 1`);
    expect(run.rows[0]!.status).toBe('quarantined');
    expect(existsSync(r.storagePath!)).toBe(true);
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

  it('dry-run não grava nada', async () => {
    const before = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    const r = await runConnector(fake(weeks(20)), { dryRun: true }, { db, snapshotRoot: root, log });
    expect(r.status).toBe('dry-run');
    const after = (await db.query<{ n: string }>('select count(*)::text as n from snapshots')).rows[0]!.n;
    expect(after).toBe(before);
  });
});
