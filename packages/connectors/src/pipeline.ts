import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { stratumKey, type Observation } from '@h1n1/core';
import { getSource, publishIndicator, rejectPublication, type Db } from '@h1n1/db';
import type { Connector, ConnectorOptions, GeoEntry, IngestResult, PipelineDeps, RawSnapshot } from './types.js';
import { Validator, type ValidationReport } from './validate.js';
import { nowStamp } from './util.js';

const BATCH = 1000;

/** Motivo gravado no sidecar quando o bruto é apagado (conectores com retainRaw: false). */
export const RAW_DELETED_REASON = 'microdados individuais; apenas agregados são retidos';
export const NOTE_PROCESSING = 'em processamento';
export const partialNote = (maxRows: number) => `execução parcial (max-rows=${maxRows}); não publicável`;

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

interface PreviousPublication { snapshotId: string; count: number; dataAsOf: string | null }

/**
 * Publicação vigente por indicador: snapshot, data_as_of e contagem de observações. Quando o conector declara
 * cobertura, a contagem é restrita a esse intervalo de períodos (o restante é carregado adiante, não comparado).
 */
async function previousPublications(db: Db, indicatorIds: string[], coverage: ReadonlyMap<string, { from: string; to: string }>): Promise<Map<string, PreviousPublication>> {
  const out = new Map<string, PreviousPublication>();
  for (const id of indicatorIds) {
    const cov = coverage.get(id);
    const r = await db.query<{ snapshot_id: string; data_as_of: string | null; n: string }>(
      `select p.snapshot_id::text as snapshot_id, p.data_as_of::text as data_as_of,
              (select count(*) from observations o where o.indicator_id = p.indicator_id and o.snapshot_id = p.snapshot_id
                 and ($2::text is null or (o.period >= $2 and o.period <= $3)))::text as n
         from indicator_publications p where p.indicator_id = $1 and p.status = 'current' limit 1`,
      [id, cov?.from ?? null, cov?.to ?? null],
    );
    const row = r.rows[0];
    if (row) out.set(id, { snapshotId: row.snapshot_id, count: Number(row.n), dataAsOf: row.data_as_of ? row.data_as_of.slice(0, 10) : null });
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

/** data_as_of da publicação: nunca retrocede (carga retroativa não rebaixa a data da vigente). */
export function maxDataAsOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/** --max-rows / SIVEP_MAX_ROWS: resolve uma única vez (CLI ou env); ≤ 0 ou NaN é ignorado. */
function resolveMaxRows(options: ConnectorOptions): number | undefined {
  const raw = options.maxRows ?? (process.env.SIVEP_MAX_ROWS ? Number(process.env.SIVEP_MAX_ROWS) : undefined);
  return raw !== undefined && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
}

export async function runConnector(connector: Connector, inputOptions: ConnectorOptions, deps: PipelineDeps): Promise<IngestResult> {
  const { db } = deps;
  const log = deps.log ?? ((m: string) => console.log(m));
  const now = deps.now ?? (() => new Date());
  const options: ConnectorOptions = { ...inputOptions };
  const maxRows = resolveMaxRows(options);
  if (maxRows !== undefined) options.maxRows = maxRows; else delete options.maxRows;
  const retainRaw = connector.retainRaw !== false;
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
    connector: connector.id, sourceId: connector.sourceId, status: 'failed', snapshotId: null, storagePath: null, rawFileDeleted: false,
    partial: maxRows !== undefined, sha256: '', rowsIn: 0, rowsOut: 0, dataAsOf: null, publishedIndicators: [], rejectedIndicators: [], validation: {},
  };
  const finishRun = async (status: 'ok' | 'failed' | 'quarantined', error: string | null) => {
    if (runId === null) return;
    await db.query(
      `update ingestion_runs set finished_at = now(), status = $2, rows_in = $3, rows_out = $4, snapshot_id = $5, error = $6 where id = $1`,
      [runId, status, result.rowsIn, result.rowsOut, result.snapshotId, error],
    );
  };

  let raw: RawSnapshot | null = null;
  let meta: Record<string, unknown> | null = null;
  let metaPath: string | null = null;
  let snapshotId: string | null = null;
  /**
   * Conectores com retainRaw: false (microdados): apaga o bruto de data/snapshots, mantém o sidecar com
   * raw_file_deleted e zera storage_path da snapshot. Idempotente; chamado após a normalização e em qualquer erro.
   */
  const discardRaw = async () => {
    if (retainRaw || !raw || !meta || !metaPath || result.rawFileDeleted) return;
    await rm(raw.path, { force: true });
    Object.assign(meta, { storage_path: null, raw_file_deleted: true, raw_file_deleted_reason: RAW_DELETED_REASON, raw_file_deleted_at: now().toISOString() });
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
    if (!dryRun && snapshotId) await db.query('update snapshots set storage_path = null where id = $1', [snapshotId]).catch(() => {});
    result.rawFileDeleted = true;
    result.storagePath = null;
    log(`[${connector.id}] bruto apagado (${RAW_DELETED_REASON}); sidecar mantido: ${basename(metaPath)}`);
  };

  try {
    if (maxRows !== undefined) log(`[${connector.id}] AVISO: --max-rows=${maxRows} — execução parcial; a snapshot ficará em quarentena e NÃO será publicada`);
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
    meta = {
      url: raw.url, urls: raw.urls, fetched_at: raw.fetched_at, sha256: raw.sha256, bytes: raw.bytes,
      content_type: raw.content_type, license: raw.license, data_as_of: raw.data_as_of, connector: connector.id,
      source_id: connector.sourceId, options, retain_raw: retainRaw, raw_file_deleted: false, ...(raw.extra ?? {}),
    };
    metaPath = `${finalPath}.meta.json`;
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
    result.storagePath = finalPath;
    log(`[${connector.id}] bruto gravado: ${basename(finalPath)} (${raw.bytes} bytes, sha256 ${raw.sha256.slice(0, 12)}…, data_as_of ${raw.data_as_of ?? '?'})`);

    // Idempotência: só uma snapshot 'ok' (publicada) com o mesmo sha256 bloqueia a reingestão.
    if (!dryRun && !options.force) {
      const dup = await db.query<{ id: string; fetched_at: string }>(
        `select id::text as id, fetched_at::text as fetched_at from snapshots where source_id = $1 and sha256 = $2 and status = 'ok' order by fetched_at desc limit 1`,
        [connector.sourceId, raw.sha256],
      );
      if (dup.rows[0]) {
        log(`[${connector.id}] sem mudança: sha256 idêntico à snapshot ${dup.rows[0].id} de ${dup.rows[0].fetched_at}; nada a reingerir (use --force para forçar)`);
        await rm(finalPath, { force: true });
        await rm(metaPath, { force: true });
        result.status = 'unchanged';
        result.snapshotId = dup.rows[0].id;
        result.storagePath = null;
        await finishRun('ok', null);
        return result;
      }
    }

    // (3) snapshot: nasce em quarentena ('em processamento') e só vira 'ok' na transação de publicação
    let ctxSnapshotId = 'dry-run';
    if (!dryRun) {
      const r = await db.query<{ id: string }>(
        `insert into snapshots (source_id, url, fetched_at, sha256, bytes, content_type, license, storage_path, data_as_of, status, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'quarantined',$10) returning id::text as id`,
        [connector.sourceId, raw.url, raw.fetched_at, raw.sha256, raw.bytes, raw.content_type, raw.license, retainRaw ? finalPath : null, raw.data_as_of, NOTE_PROCESSING],
      );
      snapshotId = r.rows[0]!.id;
      ctxSnapshotId = snapshotId;
      result.snapshotId = snapshotId;
      if (runId !== null) await db.query('update ingestion_runs set snapshot_id = $2 where id = $1', [runId, snapshotId]);
    }

    // (4) normalize → lotes
    const geoEntries: GeoEntry[] = [];
    const coverage = new Map<string, { from: string; to: string }>();
    const report: Record<string, unknown> = {};
    const validGeo = new Set((await db.query<{ code: string }>('select code from geo')).rows.map((r) => r.code));
    const validator = new Validator({ validGeoCodes: validGeo, previousCounts: new Map() }, connector.indicators);
    // geo garantida pelo conector (também em streaming): aceita pelo validador na hora; upsert antes da validação/publicação
    let geoUpserted = 0;
    const upsertPendingGeo = async () => {
      if (dryRun || geoEntries.length <= geoUpserted) return;
      const n = await upsertGeo(db, geoEntries.slice(geoUpserted));
      geoUpserted = geoEntries.length;
      log(`[${connector.id}] geo: ${n} código(s) garantido(s)`);
    };
    const ctx = {
      snapshotId: ctxSnapshotId, options, log, report,
      ensureGeo: (e: GeoEntry[]) => { geoEntries.push(...e); for (const g of e) validGeo.add(g.code); },
      countRowsIn: (n: number) => { result.rowsIn += n; },
      addError: (msg: string) => { validator.addError(msg); },
      setCoverage: (id: string, from: string, to: string) => { coverage.set(id, { from, to }); },
    };
    const out = await connector.normalize(raw, ctx);
    const batches: AsyncIterable<Observation[]> | Iterable<Observation[]> = Array.isArray(out) ? [out] : out;

    let pending: Observation[] = [];
    const flush = async () => {
      if (!pending.length) return;
      if (!dryRun) await db.transaction((tx) => insertBatch(tx, pending));
      result.rowsOut += pending.length;
      pending = [];
    };
    // geo precisa existir antes das observações? Não há FK, mas garantimos antes da validação/publicação.
    await upsertPendingGeo();
    for await (const batch of batches) {
      for (const o of batch) {
        if (o.snapshot_id !== ctxSnapshotId) o.snapshot_id = ctxSnapshotId;
        validator.add([o]);
        pending.push(o);
        if (pending.length >= BATCH) await flush();
      }
    }
    await flush();
    // geo entries que chegaram durante normalize (streams) — garantir antes da validação
    await upsertPendingGeo();
    log(`[${connector.id}] normalização: ${result.rowsIn} linha(s) lida(s) → ${result.rowsOut} observação(ões)`);
    // microdados: o bruto já cumpriu seu papel; só agregados ficam
    await discardRaw();

    // (5) validação (contagem anterior restrita à cobertura declarada pelo conector)
    const prev = await previousPublications(db, connector.indicators, coverage);
    const validation: ValidationReport = validator.finish(new Map([...prev].map(([k, v]) => [k, v.count])));
    result.validation = { ...validation, report, coverage: Object.fromEntries(coverage), max_rows: maxRows ?? null, partial: maxRows !== undefined };
    for (const [id, ir] of Object.entries(validation.indicators)) {
      log(`[${connector.id}]   ${ir.ok ? 'ok ' : 'ERRO'} ${id}: ${ir.count} obs${ir.previous_count !== null ? ` (vigente: ${ir.previous_count})` : ''}${ir.errors.length ? ' — ' + ir.errors.join('; ') : ''}`);
    }
    for (const c of validation.cross_checks) log(`[${connector.id}]   ERRO invariante cruzada (${c.rule}): ${c.count} célula(s), ex.: ${c.samples.slice(0, 2).join('; ')}`);
    for (const e of validation.connector_errors) log(`[${connector.id}]   ERRO conector: ${e}`);
    if (dryRun) {
      result.status = 'dry-run';
      log(`[${connector.id}] dry-run: nada gravado no banco (validação ${validation.ok ? 'ok' : 'FALHOU'})`);
      return result;
    }
    const sid = snapshotId!;
    const rawAsOf = raw.data_as_of;
    const urlCount = raw.urls.length;

    // (5a) execução parcial (--max-rows): nunca publicável, nunca conta como snapshot 'ok' idempotente
    if (maxRows !== undefined) {
      const note = [partialNote(maxRows), ...(validation.ok ? [] : [validation.errors.join(' | ')])].join(' | ').slice(0, 2000);
      await db.query(`update snapshots set status = 'quarantined', notes = $2 where id = $1`, [sid, note]);
      result.status = 'quarantined';
      log(`[${connector.id}] AVISO: execução parcial (max-rows=${maxRows}); snapshot ${sid} em quarentena, NÃO publicada; a publicação vigente permanece e a próxima ingestão completa não é bloqueada`);
      await finishRun('quarantined', note);
      return result;
    }

    // (5b) falha de validação: quarentena, publicação anterior permanece vigente
    if (!validation.ok) {
      await db.query(`update snapshots set status = 'quarantined', notes = $2 where id = $1`, [sid, validation.errors.join(' | ').slice(0, 2000)]);
      for (const id of connector.indicators) {
        await rejectPublication(db, id, sid, result.validation);
        result.rejectedIndicators.push(id);
      }
      result.status = 'quarantined';
      log(`[${connector.id}] QUARENTENA: ${validation.errors.length} erro(s); publicação anterior permanece vigente`);
      await finishRun('quarantined', validation.errors.join(' | ').slice(0, 2000));
      return result;
    }

    // (6) publicação atômica: carry-forward + publishIndicator de TODOS os indicadores + snapshot 'ok' na mesma transação
    const published = await db.transaction(async (tx) => {
      let carried = 0;
      for (const id of connector.indicators) {
        const cov = coverage.get(id);
        const p = prev.get(id);
        if (cov && p) carried += await carryForward(tx, id, p.snapshotId, sid, cov.from, cov.to);
      }
      let dataAsOf: string | null = null;
      const retained: string[] = [];
      const ids: string[] = [];
      for (const id of connector.indicators) {
        const p = prev.get(id);
        const asOf = maxDataAsOf(rawAsOf, p?.dataAsOf ?? null);
        if (p?.dataAsOf && rawAsOf && p.dataAsOf > rawAsOf) retained.push(`${id} (${p.dataAsOf} > ${rawAsOf})`);
        dataAsOf = maxDataAsOf(dataAsOf, asOf);
        await publishIndicator(tx, { indicatorId: id, snapshotId: sid, dataAsOf: asOf, validationReport: { ...result.validation, carried_forward_rows: carried } });
        ids.push(id);
      }
      await tx.query(`update snapshots set status = 'ok', notes = $2 where id = $1`, [sid, `conector ${connector.id}; urls: ${urlCount}; publicada`]);
      return { carried, dataAsOf, retained, ids };
    });
    result.publishedIndicators.push(...published.ids);
    if (published.carried) {
      result.rowsOut += published.carried;
      log(`[${connector.id}] carry-forward: ${published.carried} observação(ões) de períodos fora da cobertura mantidas da publicação anterior`);
    }
    if (published.retained.length) log(`[${connector.id}] data_as_of da publicação mantido no máximo vigente (carga retroativa): ${published.retained.join(', ')}`);
    result.dataAsOf = published.dataAsOf ?? rawAsOf;
    result.status = 'ok';
    log(`[${connector.id}] publicado: ${result.publishedIndicators.length} indicador(es), data_as_of ${result.dataAsOf ?? '?'}`);
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
    await discardRaw().catch(() => {});
    if (raw && !result.snapshotId && !result.rawFileDeleted) await rm(raw.path, { force: true }).catch(() => {});
    await finishRun('failed', msg.slice(0, 2000));
    return result;
  }
}
