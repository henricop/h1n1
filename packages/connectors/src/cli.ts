import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, getFreshness, migrate } from '@h1n1/db';
import { CONNECTORS, getConnector } from './registry.js';
import { runConnector } from './pipeline.js';
import type { ConnectorOptions } from './types.js';
import { parseYearRange } from './util.js';

const here = dirname(fileURLToPath(import.meta.url));

function snapshotRoot(): string {
  const env = process.env.SNAPSHOT_DIR;
  if (env) return resolve(env);
  return join(here, '..', '..', '..', 'data', 'snapshots');
}

function usage(): void {
  console.log(`uso:
  pnpm ingest <conector> [--year 2026] [--country BRA,USA] [--years 2021-2025] [--max-rows N] [--force] [--dry-run]
  pnpm ingest status     # frescor por indicador (getFreshness)
  pnpm ingest list       # conectores disponíveis
--max-rows N / SIVEP_MAX_ROWS: execução PARCIAL (desenvolvimento) — a snapshot fica em quarentena e nunca é publicada.
--country: apenas códigos ISO3 (três letras maiúsculas).
conectores: ${CONNECTORS.map((c) => c.id).join(', ')}`);
}

function parseArgs(argv: string[]): { cmd: string | undefined; options: ConnectorOptions } {
  const options: ConnectorOptions = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`valor ausente para ${a}`); return v; };
    if (a === '--year') options.year = Number(next());
    else if (a.startsWith('--year=')) options.year = Number(a.slice(7));
    else if (a === '--country') options.countries = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--country=')) options.countries = a.slice(10).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--years') options.years = parseYearRange(next());
    else if (a.startsWith('--years=')) options.years = parseYearRange(a.slice(8));
    else if (a === '--max-rows') options.maxRows = Number(next());
    else if (a.startsWith('--max-rows=')) options.maxRows = Number(a.slice(11));
    else if (a === '--force') options.force = true;
    else if (a === '--dry-run') options.dryRun = true;
    else if (a === '-h' || a === '--help') positional.push('help');
    else if (a.startsWith('--')) throw new Error(`opção desconhecida: ${a}`);
    else positional.push(a);
  }
  if (options.maxRows === undefined && process.env.SIVEP_MAX_ROWS) options.maxRows = Number(process.env.SIVEP_MAX_ROWS);
  if (options.maxRows !== undefined && !(options.maxRows > 0)) delete options.maxRows;
  return { cmd: positional[0], options };
}

async function main(): Promise<void> {
  const { cmd, options } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === 'help') { usage(); return; }
  if (cmd === 'list') {
    for (const c of CONNECTORS) console.log(`${c.id.padEnd(10)} fonte ${c.sourceId.padEnd(7)} indicadores: ${c.indicators.join(', ')}`);
    return;
  }
  const db = await createDb();
  try {
    await migrate(db);
    if (cmd === 'status') {
      const rows = await getFreshness(db);
      console.log('indicador'.padEnd(46) + 'fonte'.padEnd(8) + 'data_as_of'.padEnd(12) + 'idade(d)'.padEnd(10) + 'última execução');
      for (const r of rows) {
        console.log(
          r.indicator_id.padEnd(46) + r.source_id.padEnd(8) + String(r.data_as_of ?? '—').padEnd(12) +
          String(r.age_days ?? '—').padEnd(10) + `${r.last_run_status ?? '—'} ${r.last_run_finished_at ? r.last_run_finished_at.slice(0, 19) : ''}`,
        );
      }
      return;
    }
    const connector = getConnector(cmd);
    const t0 = Date.now();
    const res = await runConnector(connector, options, { db, snapshotRoot: snapshotRoot(), log: (m) => console.log(m) });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n[${connector.id}] resultado: ${res.status} em ${secs}s — ${res.rowsIn} linha(s) lida(s), ${res.rowsOut} observação(ões), data_as_of ${res.dataAsOf ?? '—'}, snapshot ${res.snapshotId ?? '—'}`);
    if (res.partial) console.log(`[${connector.id}] AVISO: execução parcial (--max-rows/SIVEP_MAX_ROWS) — snapshot em quarentena, NÃO publicada; a publicação vigente permanece`);
    if (res.rawFileDeleted) console.log(`[${connector.id}] bruto apagado após a agregação (microdados individuais; apenas agregados são retidos); sidecar .meta.json mantido`);
    if (res.error) console.log(`[${connector.id}] erro: ${res.error}`);
    if (res.status === 'failed') process.exitCode = 1;
    if (res.status === 'quarantined') process.exitCode = 2;
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
