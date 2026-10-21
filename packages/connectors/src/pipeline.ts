import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { stratumKey, type Observation } from '@h1n1/core';
import { getSource, publishIndicator, rejectPublication, type Db } from '@h1n1/db';
import type { Connector, ConnectorOptions, GeoEntry, IngestResult, PipelineDeps, RawSnapshot } from './types.js';
import { Validator, type ValidationReport } from './validate.js';
import { nowStamp } from './util.js';

const BATCH = 1000;

async function insertBatch(db: Db, rows: Observation[]): Promise<void> {
  if (!rows.length) return;
  const cols = 14;
  const values: string[] = [];
  const params: unknown[] = [];
  rows.forEach((o, i) => {
    const b = i * cols;
    values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11}::jsonb,$${b + 12},$${b + 13},$${b + 14})`);
    params.push(
      o.indicator_id, o.snapshot_id, o.geo_level, o.geo_code, o.period_type, o.period, o.period_start, o.period_end,
      o.value, o.denominator, JSON.stringify(o.stratum), stratumKey(o.stratum), o.update_status, o.quality_flags,
    );
  });
  await db.query(
    `insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end,
       value, denominator, stratum, stratum_key, update_status, quality_flags) values ${values.join(',')}
     on conflict on constraint observations_unique do nothing`,
    params,
  );
}

async function upsertGeo(db: Db, entries: GeoEntry[]): Promise<number> {
  let n = 0;
  for (const g of entries) {
    await db.query(
      `insert into geo (code, level, name, parent_code, ibge_id, iso2) values ($1,$2,$3,$4,$5,$6)
       on conflict (code) do update set name = excluded.name, parent_code = coalesce(excluded.parent_code, geo.parent_code),
         iso2 = coalesce(excluded.iso2, geo.iso2)`,
      [g.code, g.level, g.name, g.parent_code, g.ibge_id ?? null, g.iso2 ?? null],
    );
    n++;
  }
  return n;
}

/**
 * Contagem de observações da publicação vigente por indicador. Quando o conector declara cobertura,
 * a contagem é restrita a esse intervalo de períodos (o restante é carregado adiante, não comparado).
 */
async function previousCounts(db: Db, indicatorIds: string[], coverage: ReadonlyMap<string, { from: string; to: string }>): Promise<Map<string, { snapshotId: string; count: number }>> {
  const out = new Map<string, { snapshotId: string; count: number }>();
  for (const id of indicatorIds) {
    const cov = coverage.get(id);
    const r = await db.query<{ snapshot_id: string; n: string }>(
      `select p.snapshot_id::text as snapshot_id,
              (select count(*) from observations o where o.indicator_id = p.indicator_id and o.snapshot_id = p.snapshot_id
                 and ($2::text is null or (o.period >= $2 and o.period <= $3)))::text as n
         from indicator_publications p where p.indicator_id = $1 and p.status = 'current' limit 1`,
      [id, cov?.from ?? null, cov?.to ?? null],
    );
    const row = r.rows[0];
    if (row) out.set(id, { snapshotId: row.snapshot_id, count: Number(row.n) });
  }
  return out;
}

/**
 * Carry-forward: copia para a nova snapshot as observações da publicação vigente cujo período está fora
 * da cobertura declarada pelo conector (ex.: SIVEP 2025 e 2026 são arquivos distintos da mesma série).
 */
async function carryForward(db: Db, indicatorId: string, fromSnapshot: string, toSnapshot: string, from: string, to: string): Promise<number> {
  const r = await db.query<{ n: string }>(
    `with ins as (
       insert into observations (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, period_start, period_end,
         value, denominator, stratum, stratum_key, update_status, quality_flags)
       select indicator_id, $2::uuid, geo_level, geo_code, period_type, period, period_start, period_end, value, denominator,
         stratum, stratum_key, update_status,
         case when 'carried_forward' = any(quality_flags) then quality_flags else array_append(quality_flags, 'carried_forward') end
       from observations where indicator_id = $1 and snapshot_id = $3::uuid and (period < $4 or period > $5)
       on conflict on constraint observations_unique do nothing
       returning 1)
     select count(*)::text as n from ins`,
    [indicatorId, toSnapshot, fromSnapshot, from, to],
  );
  return Number(r.rows[0]?.n ?? 0);
}

export async function runConnector(connector: Connector, options: ConnectorOptions, deps: PipelineDeps): Promise<IngestResult> {
  const { db } = deps;
  const log = deps.log ?? ((m: string) => console.log(m));
  const now = deps.now ?? (() => new Date());
  const source = await getSource(db, connector.sourceId);
  if (!source) throw new Error(`Fonte ${connector.sourceId} não existe no banco; rode o seed primeiro`);
  const sourceDir = join(deps.snapshotRoot, source.slug);
  const tmpDir = join(sourceDir, 'tmp');
  await mkdir(tmpDir, { recursive: true });

  const dryRun = Boolean(options.dryRun);
  let runId: number | null = null;
  if (!dryRun) {
    const r = await db.query<{ id: string }>(
      `insert into ingestion_runs (source_id, connector, status, params) values ($1, $2, 'running', $3) returning id::text as id`,
      [connector.sourceId, connector.id, JSON.stringify(options)],
    );
    runId = Number(r.rows[0]!.id);
  }

  const result: IngestResult = {
    connector: connector.id, sourceId: connector.sourceId, status: 'failed', snapshotId: null, storagePath: null, sha256: '',
    rowsIn: 0, rowsOut: 0, dataAsOf: null, publishedIndicators: [], rejectedIndicators: [], validation: {},
  };
  const finishRun = async (status: 'ok' | 'failed' | 'quarantined', error: string | null) => {
    if (runId === null) return;
    await db.query(
      `update ingestion_runs set finished_at = now(), status = $2, rows_in = $3, rows_out = $4, snapshot_id = $5, error = $6 where id = $1`,
      [runId, status, result.rowsIn, result.rowsOut, result.snapshotId, error],
    );
  };

  let raw: RawSnapshot | null = null;
  try {
    // (2) fetch → arquivo bruto + sidecar
    log(`[${connector.id}] baixando…`);
    raw = await connector.fetch({ options, log, tmpDir });
    result.sha256 = raw.sha256;
    result.dataAsOf = raw.data_as_of;
    const stamp = nowStamp(now());
    const fileName = `${stamp}_${raw.sha256.slice(0, 12)}.${raw.ext}`;
    const finalPath = join(sourceDir, fileName);
    await rename(raw.path, finalPath);
    raw.path = finalPath;
    const meta = {
      url: raw.url, urls: raw.urls, fetched_at: raw.fetched_at, sha256: raw.sha256, bytes: raw.bytes,
      content_type: raw.content_type, license: raw.license, data_as_of: raw.data_as_of, connector: connector.id,
      source_id: connector.sourceId, options, ...(raw.extra ?? {}),
    };
    await writeFile(`${finalPath}.meta.json`, JSON.stringify(meta, null, 2));
    result.storagePath = finalPath;
    log(`[${connector.id}] bruto gravado: ${basename(finalPath)} (${raw.bytes} bytes, sha256 ${raw.sha256.slice(0, 12)}…, data_as_of ${raw.data_as_of ?? '?'})`);

    // Idempotência
    if (!dryRun && !options.force) {
      const dup = await db.query<{ id: string; fetched_at: string }>(
        `select id::text as id, fetched_at::text as fetched_at from snapshots where source_id = $1 and sha256 = $2 and status = 'ok' order by fetched_at desc limit 1`,
        [connector.sourceId, raw.sha256],
      );
      if (dup.rows[0]) {
        log(`[${connector.id}] sem mudança: sha256 idêntico à snapshot ${dup.rows[0].id} de ${dup.rows[0].fetched_at}; nada a reingerir (use --force para forçar)`);
        await rm(finalPath, { force: true });
        await rm(`${finalPath}.meta.json`, { force: true });
        result.status = 'unchanged';
        result.snapshotId = dup.rows[0].id;
        result.storagePath = null;
        await finishRun('ok', null);
        return result;
      }
    }

    // (3) snapshot
    let snapshotId = 'dry-run';
    if (!dryRun) {
      const r = await db.query<{ id: string }>(
        `insert into snapshots (source_id, url, fetched_at, sha256, bytes, content_type, license, storage_path, data_as_of, status, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ok',$10) returning id::text as id`,
        [connector.sourceId, raw.url, raw.fetched_at, raw.sha256, raw.bytes, raw.content_type, raw.license, finalPath, raw.data_as_of,
          `conector ${connector.id}; urls: ${raw.urls.length}`],
      );
      snapshotId = r.rows[0]!.id;
      result.snapshotId = snapshotId;
      if (runId !== null) await db.query('update ingestion_runs set snapshot_id = $2 where id = $1', [runId, snapshotId]);
    }

    // (4) normalize → lotes
    const geoEntries: GeoEntry[] = [];
    const coverage = new Map<string, { from: string; to: string }>();
    const report: Record<string, unknown> = {};
    const ctx = {
      snapshotId, options, log, report,
      ensureGeo: (e: GeoEntry[]) => { geoEntries.push(...e); },
      countRowsIn: (n: number) => { result.rowsIn += n; },
      setCoverage: (id: string, from: string, to: string) => { coverage.set(id, { from, to }); },
    };
    const out = await connector.normalize(raw, ctx);
    const batches: AsyncIterable<Observation[]> | Iterable<Observation[]> = Array.isArray(out) ? [out] : out;

    const validGeo = new Set((await db.query<{ code: string }>('select code from geo')).rows.map((r) => r.code));
    for (const g of geoEntries) validGeo.add(g.code);
    const validator = new Validator({ validGeoCodes: validGeo, previousCounts: new Map() }, connector.indicators);

    let pending: Observation[] = [];
    const flush = async () => {
      if (!pending.length) return;
      if (!dryRun) await db.transaction((tx) => insertBatch(tx, pending));
      result.rowsOut += pending.length;
      pending = [];
    };
    // geo precisa existir antes das observações? Não há FK, mas garantimos antes da validação/publicação.
    if (!dryRun && geoEntries.length) log(`[${connector.id}] geo: ${await upsertGeo(db, geoEntries)} código(s) garantido(s)`);
    for await (const batch of batches) {
      for (const o of batch) {
        if (o.snapshot_id !== snapshotId) o.snapshot_id = snapshotId;
        validator.add([o]);
        pending.push(o);
        if (pending.length >= BATCH) await flush();
      }
    }
    await flush();
    // geo entries que chegaram durante normalize (streams) — garantir de novo
    if (!dryRun && geoEntries.length) {
      const missing = geoEntries.filter((g) => !validGeo.has(g.code));
      if (missing.length) await upsertGeo(db, missing);
    }
    for (const g of geoEntries) validGeo.add(g.code);
    log(`[${connector.id}] normalização: ${result.rowsIn} linha(s) lida(s) → ${result.rowsOut} observação(ões)`);

    // (5) validação + publicação (contagem anterior restrita à cobertura declarada pelo conector)
    const prev = await previousCounts(db, connector.indicators, coverage);
    const validation: ValidationReport = validator.finish(new Map([...prev].map(([k, v]) => [k, v.count])));
    result.validation = { ...validation, report, coverage: Object.fromEntries(coverage) };
    for (const [id, ir] of Object.entries(validation.indicators)) {
      log(`[${connector.id}]   ${ir.ok ? 'ok ' : 'ERRO'} ${id}: ${ir.count} obs${ir.previous_count !== null ? ` (vigente: ${ir.previous_count})` : ''}${ir.errors.length ? ' — ' + ir.errors.join('; ') : ''}`);
    }
    if (dryRun) {
      result.status = 'dry-run';
      log(`[${connector.id}] dry-run: nada gravado no banco (validação ${validation.ok ? 'ok' : 'FALHOU'})`);
      return result;
    }
    if (!validation.ok) {
      await db.query(`update snapshots set status = 'quarantined', notes = $2 where id = $1`, [snapshotId, validation.errors.join(' | ').slice(0, 2000)]);
      for (const id of connector.indicators) {
        await rejectPublication(db, id, snapshotId, result.validation);
        result.rejectedIndicators.push(id);
      }
      result.status = 'quarantined';
      log(`[${connector.id}] QUARENTENA: ${validation.errors.length} erro(s); publicação anterior permanece vigente`);
      await finishRun('quarantined', validation.errors.join(' | ').slice(0, 2000));
      return result;
    }
    let carried = 0;
    for (const id of connector.indicators) {
      const cov = coverage.get(id);
      const p = prev.get(id);
      if (cov && p) carried += await carryForward(db, id, p.snapshotId, snapshotId, cov.from, cov.to);
      await publishIndicator(db, { indicatorId: id, snapshotId, dataAsOf: raw.data_as_of, validationReport: { ...result.validation, carried_forward_rows: carried } });
      result.publishedIndicators.push(id);
    }
    if (carried) {
      result.rowsOut += carried;
      log(`[${connector.id}] carry-forward: ${carried} observação(ões) de períodos fora da cobertura mantidas da publicação anterior`);
    }
    result.status = 'ok';
    log(`[${connector.id}] publicado: ${result.publishedIndicators.length} indicador(es), data_as_of ${raw.data_as_of ?? '?'}`);
    await finishRun('ok', null);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}` : String(e);
    result.error = msg;
    result.status = 'failed';
    log(`[${connector.id}] FALHA: ${msg}`);
    if (result.snapshotId && !dryRun) {
      await db.query(`update snapshots set status = 'failed', notes = $2 where id = $1`, [result.snapshotId, msg.slice(0, 2000)]).catch(() => {});
    }
    if (raw && !result.snapshotId) await rm(raw.path, { force: true }).catch(() => {});
    await finishRun('failed', msg.slice(0, 2000));
    return result;
  }
}
