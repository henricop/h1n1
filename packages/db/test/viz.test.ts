import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb, migrate, type Db } from '../src/client.js';
import { seedAll } from '../src/seed.js';
import { getMatrix, listIngestionRuns, publishIndicator, sanitizeRunError } from '../src/queries.js';

let db: Db;
beforeAll(async () => {
  db = await createDb({ databaseUrl: null, pgliteDir: 'memory://' });
  await migrate(db);
  await seedAll(db);
});
afterAll(async () => db.close());

async function insertSnapshot(sourceId: string, dataAsOf: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into snapshots (source_id, url, sha256, status, data_as_of, license) values ($1,'https://x',$2,'ok',$3,'CC-BY') returning id::text as id`,
    [sourceId, 'hash-' + sourceId + dataAsOf + Math.random(), dataAsOf],
  );
  return r.rows[0]!.id;
}

const FLU = 'flunet_ah1n1pdm09_detections';
const SIVEP = 'sivep_srag_ah1n1pdm09_confirmed';

describe('getMatrix', () => {
  it('matriz geo × período em uma query, alinhada e com null nas células ausentes; só a snapshot vigente', async () => {
    const old = await insertSnapshot('INT-01', '2026-10-05');
    const cur = await insertSnapshot('INT-01', '2026-10-12');
    const ins = (snap: string, geo: string, period: string, value: number, key = '', status = 'final') =>
      db.query(
        `insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end, value, stratum, stratum_key, update_status)
         values ($1, $2, 'country', $3, 'isoweek', $4, '2026-01-05', '2026-01-11', $5, $6::jsonb, $7, $8)`,
        [FLU, snap, geo, period, value, key ? JSON.stringify({ origin_source: key.split('=')[1] }) : '{}', key, status],
      );
    await ins(old, 'BRA', '2026-W01', 999);
    await ins(cur, 'BRA', '2026-W01', 5);
    await ins(cur, 'BRA', '2026-W02', 7, '', 'provisional');
    await ins(cur, 'USA', '2026-W02', 3);
    await ins(cur, 'USA', '2026-W03', 4);
    await ins(cur, 'USA', '2026-W02', 2, 'origin_source=SENTINEL');

    expect((await getMatrix(db, { indicator: FLU, geoLevel: 'country' }))!.rows).toHaveLength(0);
    await publishIndicator(db, { indicatorId: FLU, snapshotId: cur, dataAsOf: '2026-10-12' });
    const m = (await getMatrix(db, { indicator: FLU, geoLevel: 'country' }))!;
    expect(m.periods).toEqual(['2026-W01', '2026-W02', '2026-W03']);
    expect(m.rows.map((r) => r.geo_code)).toEqual(['BRA', 'USA']);
    expect(m.rows[0]!.values).toEqual([5, 7, null]);
    expect(m.rows[0]!.provisional).toEqual([false, true, false]);
    expect(m.rows[1]!.values).toEqual([null, 3, 4]);
    expect(m.meta.data_as_of).toBe('2026-10-12');
    expect(JSON.stringify(m)).not.toContain('999');

    const sent = (await getMatrix(db, { indicator: FLU, geoLevel: 'country', stratumKey: 'origin_source=SENTINEL' }))!;
    expect(sent.periods).toEqual(['2026-W02']);
    expect(sent.rows).toEqual([{ geo_code: 'USA', values: [2], provisional: [false] }]);

    const sub = (await getMatrix(db, { indicator: FLU, geoLevel: 'country', from: '2026-W02', to: '2026-W02', geoCodes: ['BRA'] }))!;
    expect(sub.periods).toEqual(['2026-W02']);
    expect(sub.rows).toEqual([{ geo_code: 'BRA', values: [7], provisional: [true] }]);
    expect(await getMatrix(db, { indicator: 'nao_existe', geoLevel: 'country' })).toBeNull();
  });

  it('aplica a máscara de supressão simples em recorte subnacional (defesa em profundidade)', async () => {
    const snap = await insertSnapshot('BR-03', '2026-10-19');
    await db.query(
      `insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end, value)
       values ($1, $2, 'state', 'BR-AC', 'epiweek', '2026-W01', '2026-01-04', '2026-01-10', 3)`,
      [SIVEP, snap],
    );
    await publishIndicator(db, { indicatorId: SIVEP, snapshotId: snap, dataAsOf: '2026-10-19' });
    const m = (await getMatrix(db, { indicator: SIVEP, geoLevel: 'state' }))!;
    expect(m.rows[0]!.values).toEqual([null]);
    expect(JSON.stringify(m)).not.toContain('"values":[3]');
  });
});

describe('listIngestionRuns', () => {
  it('lista runs sem params e com erro sem caminhos de disco e truncado a 200 caracteres', async () => {
    const longErr = 'ENOENT: no such file, open /Users/alguem/Projects/h1n1/data/snapshots/INFLUD26.csv ' + 'x'.repeat(300);
    await db.query(
      `insert into ingestion_runs (source_id, connector, status, rows_in, rows_out, error, params, finished_at)
       values ('BR-03', 'sivep', 'failed', 10, 0, $1, '{"path":"/tmp/secreto.csv"}', now())`,
      [longErr],
    );
    await db.query(`insert into ingestion_runs (source_id, connector, status) values ('INT-01', 'flunet', 'running')`);
    const runs = await listIngestionRuns(db, { limit: 10 });
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs[0]).toMatchObject({ source_id: 'INT-01', connector: 'flunet', status: 'running', finished_at: null, error: null });
    const failed = runs.find((r) => r.status === 'failed')!;
    expect(failed.rows_in).toBe(10);
    expect(failed.error!.length).toBeLessThanOrEqual(200);
    expect(failed.error).not.toContain('/Users');
    expect(failed.error).not.toContain('INFLUD26.csv');
    expect(failed.error).toContain('[caminho]');
    expect(JSON.stringify(runs)).not.toContain('secreto');
    expect((await listIngestionRuns(db, { sourceId: 'BR-03' })).every((r) => r.source_id === 'BR-03')).toBe(true);
  });

  it('sanitizeRunError cobre POSIX, relativo, Windows e vazio', () => {
    expect(sanitizeRunError('falha em /var/data/x.csv e C:\\dados\\y.csv')).toBe('falha em [caminho] e [caminho]');
    expect(sanitizeRunError('arquivo ./data/pglite não encontrado')).toBe('arquivo [caminho] não encontrado');
    expect(sanitizeRunError('timeout de 30s')).toBe('timeout de 30s');
    expect(sanitizeRunError(null)).toBeNull();
    expect(sanitizeRunError('   ')).toBeNull();
  });
});
