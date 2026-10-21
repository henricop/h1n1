/**
 * Consulta de sanidade pós-ingestão (sem supressão: leitura direta das publicações vigentes).
 * uso: pnpm --filter @h1n1/connectors exec tsx scripts/sanity.ts
 */
import { createDb, getSeries } from '@h1n1/db';

const db = await createDb();
try {
  const show = async (title: string, indicator: string, geoCode: string, n = 10) => {
    const s = await getSeries(db, { indicator, geoCode });
    if (!s || !s.publication) { console.log(`${title}: sem publicação vigente`); return; }
    const last = s.observations.slice(-n);
    console.log(`\n${title} — data_as_of ${s.meta.data_as_of}, ${s.meta.count} períodos, snapshot ${s.publication.snapshot_id.slice(0, 8)}…`);
    for (const o of last) {
      const flags = o.quality_flags.length ? ` [${o.quality_flags.join(',')}]` : '';
      console.log(`  ${o.period}  ${o.period_start}..${o.period_end}  value=${o.value === null ? 'null' : o.value}${o.denominator !== null ? ` den=${o.denominator}` : ''}  ${o.update_status}${flags}`);
    }
  };
  await show('SIVEP · SRAG por A(H1N1)pdm09 confirmada · BRA · últimas 10 SE', 'sivep_srag_ah1n1pdm09_confirmed', 'BRA');
  await show('SIVEP · notificações de SRAG · BRA · últimas 10 SE', 'sivep_srag_notifications', 'BRA');
  await show('FluNet · detecções A(H1N1)pdm09 · BRA · últimas 10 semanas ISO', 'flunet_ah1n1pdm09_detections', 'BRA');
  await show('FluNet · positividade influenza · BRA · últimas 5', 'flunet_influenza_positivity', 'BRA', 5);
  await show('IBGE · população · BR-SP', 'ibge_population_estimate', 'BR-SP', 3);
  await show('Banco Mundial · população · BRA', 'worldbank_population_total', 'BRA', 3);
  await show('UKHSA · positividade · ENG · últimas 5', 'ukhsa_influenza_testing_positivity', 'ENG', 5);

  const totals = await db.query<{ indicator_id: string; n: string; periods: string; min_p: string; max_p: string }>(
    `select o.indicator_id, count(*)::text as n, count(distinct o.period)::text as periods, min(o.period) as min_p, max(o.period) as max_p
       from observations o join indicator_publications p on p.snapshot_id = o.snapshot_id and p.indicator_id = o.indicator_id and p.status = 'current'
      group by o.indicator_id order by 1`,
  );
  console.log('\nObservações por indicador na publicação vigente:');
  for (const t of totals.rows) console.log(`  ${t.indicator_id.padEnd(46)} ${t.n.padStart(7)} obs  ${t.periods.padStart(5)} períodos  ${t.min_p} .. ${t.max_p}`);
  const runs = await db.query<{ connector: string; status: string; rows_in: string; rows_out: string; started_at: string; finished_at: string | null }>(
    `select connector, status, rows_in::text as rows_in, rows_out::text as rows_out, started_at::text as started_at, finished_at::text as finished_at from ingestion_runs order by id`,
  );
  console.log('\nExecuções (ingestion_runs):');
  for (const r of runs.rows) console.log(`  ${r.connector.padEnd(10)} ${r.status.padEnd(12)} in=${r.rows_in.padStart(7)} out=${r.rows_out.padStart(7)}  ${r.started_at.slice(0, 19)} → ${(r.finished_at ?? '').slice(0, 19)}`);
  const snaps = await db.query<{ source_id: string; status: string; n: string }>(`select source_id, status, count(*)::text as n from snapshots group by 1,2 order by 1,2`);
  console.log('\nSnapshots por fonte/status:');
  for (const s of snaps.rows) console.log(`  ${s.source_id.padEnd(8)} ${s.status.padEnd(12)} ${s.n}`);
} finally {
  await db.close();
}
