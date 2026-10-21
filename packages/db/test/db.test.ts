import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb, migrate, type Db } from '../src/client.js';
import { seedAll } from '../src/seed.js';
import { getSeries, publishIndicator, getFreshness, listSources, diffSnapshots } from '../src/queries.js';

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
    [sourceId, 'hash-' + dataAsOf, dataAsOf],
  );
  return r.rows[0]!.id;
}

describe('db', () => {
  it('seed carrega 65 fontes e os indicadores', async () => {
    expect(await listSources(db)).toHaveLength(65);
    const ind = await db.query<{ n: string }>('select count(*)::text as n from indicators');
    expect(Number(ind.rows[0]!.n)).toBeGreaterThan(15);
  });

  it('série só sai da snapshot vigente, com supressão e sem revelar valor bruto', async () => {
    const s1 = await insertSnapshot('BR-03', '2026-10-12');
    const s2 = await insertSnapshot('BR-03', '2026-10-19');
    const ins = (snap: string, geo: string, level: string, period: string, value: number, stratum = '{}', key = '') =>
      db.query(
        `insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end, value, stratum, stratum_key)
         values ('sivep_srag_ah1n1pdm09_confirmed', $1, $2, $3, 'epiweek', $4, '2026-01-04', '2026-01-10', $5, $6::jsonb, $7)`,
        [snap, level, geo, period, value, stratum, key],
      );
    await ins(s1, 'BRA', 'country', '2026-W01', 10);
    await ins(s2, 'BRA', 'country', '2026-W01', 12);
    await ins(s2, 'BR-SC', 'state', '2026-W01', 3);
    await ins(s2, 'BR-SC', 'state', '2026-W01', 2, '{"age_group":"0-4"}', 'age_group=0-4');
    await ins(s2, 'BR-SC', 'state', '2026-W01', 1, '{"age_group":"65+"}', 'age_group=65+');

    expect((await getSeries(db, { indicator: 'sivep_srag_ah1n1pdm09_confirmed' }))!.observations).toHaveLength(0);
    await publishIndicator(db, { indicatorId: 'sivep_srag_ah1n1pdm09_confirmed', snapshotId: s1, dataAsOf: '2026-10-12' });
    let r = await getSeries(db, { indicator: 'sivep_srag_ah1n1pdm09_confirmed', geoCode: 'BRA' });
    expect(r!.observations[0]!.value).toBe(10);
    expect(r!.meta.data_as_of).toBe('2026-10-12');

    await publishIndicator(db, { indicatorId: 'sivep_srag_ah1n1pdm09_confirmed', snapshotId: s2, dataAsOf: '2026-10-19' });
    r = await getSeries(db, { indicator: 'sivep_srag_ah1n1pdm09_confirmed', geoCode: 'BRA' });
    expect(r!.observations[0]!.value).toBe(12);
    const current = await db.query<{ n: string }>(`select count(*)::text as n from indicator_publications where status='current'`);
    expect(Number(current.rows[0]!.n)).toBe(1);

    const sc = await getSeries(db, { indicator: 'sivep_srag_ah1n1pdm09_confirmed', geoCode: 'BR-SC', includeStrata: true });
    expect(sc!.observations.every((o) => o.suppressed && o.value === null)).toBe(true);
    expect(JSON.stringify(sc)).not.toContain('"value":3');

    const diff = await diffSnapshots(db, 'sivep_srag_ah1n1pdm09_confirmed', s1, s2);
    expect(diff.find((d) => d.geo_code === 'BRA')).toMatchObject({ value_a: 10, value_b: 12, suppressed: false });
    // diff restrito a país sem estrato: células estaduais/estratificadas nunca saem
    expect(diff).toHaveLength(1);
    expect(diff.every((d) => d.geo_level === 'country' && d.stratum_key === '')).toBe(true);
    expect(JSON.stringify(diff)).not.toContain('BR-SC');

    const fresh = await getFreshness(db);
    const row = fresh.find((f) => f.indicator_id === 'sivep_srag_ah1n1pdm09_confirmed')!;
    expect(row.data_as_of).toBe('2026-10-19');
    expect(row.age_days).toBe(0);
  });

  it('supressão complementar é calculada sobre o grupo completo mesmo consultando um único estrato', async () => {
    const IND = 'sivep_srag_ah1n1pdm09_confirmed';
    const snap = await insertSnapshot('BR-03', '2026-10-26');
    const ins = (geo: string, period: string, value: number, stratum = '{}', key = '') =>
      db.query(
        `insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end, value, stratum, stratum_key)
         values ($1, $2, 'state', $3, 'epiweek', $4, '2026-01-04', '2026-01-10', $5, $6::jsonb, $7)`,
        [IND, snap, geo, period, value, stratum, key],
      );
    // total 40 + estratos 3 / 7 / 30: o 3 é suprimido pelo limiar e o 7 pela supressão complementar
    await ins('BR-RJ', '2026-W01', 40);
    await ins('BR-RJ', '2026-W01', 3, '{"age_group":"0-4"}', 'age_group=0-4');
    await ins('BR-RJ', '2026-W01', 7, '{"age_group":"5-14"}', 'age_group=5-14');
    await ins('BR-RJ', '2026-W01', 30, '{"age_group":"15-29"}', 'age_group=15-29');
    await publishIndicator(db, { indicatorId: IND, snapshotId: snap, dataAsOf: '2026-10-26' });

    const one = await getSeries(db, { indicator: IND, geoCode: 'BR-RJ', stratum: { age_group: '5-14' } });
    expect(one!.observations).toHaveLength(1);
    expect(one!.observations[0]).toMatchObject({ stratum: { age_group: '5-14' }, value: null, suppressed: true });
    expect(JSON.stringify(one)).not.toContain('"value":7');
    expect(one!.meta.truncated).toBe(false);

    const big = await getSeries(db, { indicator: IND, geoCode: 'BR-RJ', stratum: { age_group: '15-29' } });
    expect(big!.observations[0]).toMatchObject({ value: 30, suppressed: false });

    const all = await getSeries(db, { indicator: IND, geoCode: 'BR-RJ', includeStrata: true });
    expect(all!.observations).toHaveLength(4);
    expect(all!.observations.filter((o) => o.suppressed).map((o) => o.stratum['age_group']).sort()).toEqual(['0-4', '5-14']);
    expect(all!.observations.find((o) => Object.keys(o.stratum).length === 0)).toMatchObject({ value: 40, suppressed: false });

    // só total: sem grupo, sem complementar
    const total = await getSeries(db, { indicator: IND, geoCode: 'BR-RJ' });
    expect(total!.observations).toHaveLength(1);
    expect(total!.observations[0]).toMatchObject({ value: 40, suppressed: false });

    // limit corta depois da supressão sobre o grupo e marca truncated
    const cut = await getSeries(db, { indicator: IND, geoCode: 'BR-RJ', includeStrata: true, limit: 2 });
    expect(cut!.observations).toHaveLength(2);
    expect(cut!.meta.truncated).toBe(true);
    expect(cut!.meta.count).toBe(2);
    expect(JSON.stringify(cut)).not.toContain('"value":7');
  });
});
