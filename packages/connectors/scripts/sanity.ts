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

  // FluNet global: países com dados na publicação vigente e A(H1N1)pdm09 somado por semana ISO na pandemia de 2009
  const fl = await db.query<{ countries: string; obs: string }>(
    `select count(distinct o.geo_code)::text as countries, count(*)::text as obs
       from observations o join indicator_publications p on p.snapshot_id = o.snapshot_id and p.indicator_id = o.indicator_id and p.status = 'current'
      where o.indicator_id = 'flunet_ah1n1pdm09_detections' and o.stratum_key = ''`,
  );
  console.log(`\nFluNet · países com dados (flunet_ah1n1pdm09_detections, vigente): ${fl.rows[0]?.countries ?? 0} (${fl.rows[0]?.obs ?? 0} obs sem estrato)`);
  const pand = await db.query<{ period: string; countries: string; value: string }>(
    `select o.period, count(distinct o.geo_code)::text as countries, sum(o.value)::text as value
       from observations o join indicator_publications p on p.snapshot_id = o.snapshot_id and p.indicator_id = o.indicator_id and p.status = 'current'
      where o.indicator_id = 'flunet_ah1n1pdm09_detections' and o.stratum_key = '' and o.period between '2009-W17' and '2009-W30'
      group by o.period order by o.period`,
  );
  console.log('FluNet · A(H1N1)pdm09 global por semana ISO, 2009-W17..W30 (soma dos países, sem estrato):');
  for (const r of pand.rows) console.log(`  ${r.period}  países=${r.countries.padStart(3)}  detecções=${r.value}`);

  // SIVEP · atraso de notificação (CDF) nacional
  const cdf = await db.query<{ period: string; d: string; value: string | null; n: string; flags: string[] }>(
    `select o.period, o.stratum->>'delay_weeks' as d, o.value::text as value, o.denominator::text as n, o.quality_flags as flags
       from observations o join indicator_publications p on p.snapshot_id = o.snapshot_id and p.indicator_id = o.indicator_id and p.status = 'current'
      where o.indicator_id = 'sivep_reporting_delay_cdf' and o.geo_code = 'BRA' order by o.period, (o.stratum->>'delay_weeks')::int`,
  );
  if (cdf.rows.length) {
    const pub = await getSeries(db, { indicator: 'sivep_reporting_delay_cdf', geoCode: 'BRA' });
    console.log(`\nSIVEP · sivep_reporting_delay_cdf · BRA — data_as_of ${pub?.meta.data_as_of ?? '?'}:`);
    for (const r of cdf.rows) console.log(`  ${r.period} d=${r.d.padStart(2)}  value=${r.value ?? 'null'}  n=${r.n}${r.flags.length ? ` [${r.flags.join(',')}]` : ''}`);
    const cov = await db.query<{ cov: unknown }>(`select validation_report->'report'->'delay_window_coverage' as cov from indicator_publications where indicator_id = 'sivep_reporting_delay_cdf' and status = 'current'`);
    console.log(`  delay_window_coverage: ${JSON.stringify(cov.rows[0]?.cov ?? null)}`);
    const ufs = await db.query<{ n: string }>(
      `select count(distinct o.geo_code)::text as n from observations o join indicator_publications p on p.snapshot_id = o.snapshot_id and p.indicator_id = o.indicator_id and p.status = 'current'
        where o.indicator_id = 'sivep_reporting_delay_cdf' and o.geo_level = 'state' and o.value is not null`,
    );
    console.log(`  UFs com CDF não nula (n ≥ 100): ${ufs.rows[0]?.n ?? 0}`);
  } else console.log('\nSIVEP · sivep_reporting_delay_cdf: sem publicação vigente');

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
