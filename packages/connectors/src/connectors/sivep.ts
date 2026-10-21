import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse';
import {
  BR_STATE_BY_UF, ageGroupFromYears, epiWeek, stateGeoCode, weekPeriodId, type Observation, type UpdateStatus,
} from '@h1n1/core';
import type { Connector, FetchContext, NormalizeContext, RawSnapshot } from '../types.js';
import { downloadToFile, fetchText } from '../http.js';
import { makeObs, parseFlexibleDate, toInt } from '../util.js';

export const SIVEP_DATASET_URL = 'https://dadosabertos.saude.gov.br/dataset/srag-2019-a-2026';
export const SIVEP_LICENSE = 'CC-BY (Ministério da Saúde / dadosabertos.saude.gov.br)';
const PROVISIONAL_WEEKS = 8;
export const AGE_GROUPS = ['0-4', '5-14', '15-29', '30-49', '50-64', '65+', 'NA'] as const;

/** Indicadores de contagem: id → predicado sobre a linha (definições de caso de core/indicators.ts). */
export interface SivepRow {
  classi_fin: number | null;
  pcr_fluasu: number | null;
  tp_flu_pcr: number | null;
  evolucao: number | null;
  uti: number | null;
}
export const COUNT_RULES: ReadonlyArray<{ id: string; test: (r: SivepRow) => boolean }> = [
  { id: 'sivep_srag_notifications', test: () => true },
  { id: 'sivep_srag_influenza_confirmed', test: (r) => r.classi_fin === 1 },
  { id: 'sivep_srag_ah1n1pdm09_confirmed', test: (r) => r.classi_fin === 1 && r.pcr_fluasu === 1 },
  { id: 'sivep_srag_ah3n2_confirmed', test: (r) => r.classi_fin === 1 && r.pcr_fluasu === 2 },
  { id: 'sivep_srag_inf_a_not_subtyped', test: (r) => r.classi_fin === 1 && (r.pcr_fluasu === 3 || r.pcr_fluasu === 4) },
  { id: 'sivep_srag_influenza_deaths', test: (r) => r.classi_fin === 1 && r.evolucao === 2 },
  { id: 'sivep_srag_ah1n1pdm09_deaths', test: (r) => r.classi_fin === 1 && r.pcr_fluasu === 1 && r.evolucao === 2 },
  { id: 'sivep_srag_influenza_icu', test: (r) => r.classi_fin === 1 && r.uti === 1 },
];
export const COMPLETENESS_ID = 'sivep_srag_influenza_subtype_completeness';
export const SIVEP_INDICATORS = [...COUNT_RULES.map((r) => r.id), COMPLETENESS_ID];

/** Descobre a URL do CSV do ano no HTML do dataset (a data no nome do arquivo muda a cada carga). */
export function findSivepUrl(html: string, year: number): string | null {
  const yy = String(year).slice(2);
  const re = new RegExp(`https?://[^"'\\s<>]*?/SRAG/${year}/INFLUD${yy}-[\\d-]+\\.csv`);
  const m = re.exec(html);
  return m ? m[0] : null;
}

/** Data no nome do arquivo (INFLUD26-19-10-2026.csv → 2026-10-19). */
export function dataAsOfFromUrl(url: string): string | null {
  const m = /INFLUD\d{2}-(\d{2})-(\d{2})-(\d{4})\.csv/.exec(url);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Agregador em memória: nunca guarda linhas individuais, só contagens por célula. */
class Aggregator {
  readonly year: number;
  /** key: indicator|geo|week|age → count */
  readonly cells = new Map<string, number>();
  /** completude: numerador/denominador por semana (nacional) */
  readonly compNum = new Map<number, number>();
  readonly compDen = new Map<number, number>();
  maxWeek = 0;
  rowsTotal = 0;
  rowsUsed = 0;
  rowsUfIgnored = 0;
  rowsNoDate = 0;
  rowsOutsideYear = 0;
  rowsWeekMismatch = 0;

  constructor(year: number) { this.year = year; }

  private bump(key: string) { this.cells.set(key, (this.cells.get(key) ?? 0) + 1); }

  add(rec: Record<string, string>): void {
    this.rowsTotal++;
    const dt = parseFlexibleDate(rec.DT_SIN_PRI);
    let year: number; let week: number;
    const semPri = toInt(rec.SEM_PRI);
    if (dt) {
      ({ year, week } = epiWeek(dt));
      if (semPri !== null && semPri !== week) this.rowsWeekMismatch++;
    } else if (semPri !== null && semPri >= 1 && semPri <= 53) {
      year = this.year; week = semPri;
    } else { this.rowsNoDate++; return; }
    if (year !== this.year || week < 1 || week > 53) { this.rowsOutsideYear++; return; }
    this.rowsUsed++;
    if (week > this.maxWeek) this.maxWeek = week;

    const row: SivepRow = {
      classi_fin: toInt(rec.CLASSI_FIN), pcr_fluasu: toInt(rec.PCR_FLUASU), tp_flu_pcr: toInt(rec.TP_FLU_PCR),
      evolucao: toInt(rec.EVOLUCAO), uti: toInt(rec.UTI),
    };
    const uf = (rec.SG_UF ?? '').trim().toUpperCase();
    const state = BR_STATE_BY_UF.get(uf);
    if (!state) this.rowsUfIgnored++;
    const idadeN = toInt(rec.NU_IDADE_N);
    const years = idadeN === null ? null : toInt(rec.TP_IDADE) === 3 ? idadeN : 0;
    const age = ageGroupFromYears(years);

    for (const rule of COUNT_RULES) {
      if (!rule.test(row)) continue;
      this.bump(`${rule.id}|BRA|${week}|`);
      this.bump(`${rule.id}|BRA|${week}|${age}`);
      if (state) {
        const g = stateGeoCode(state.uf);
        this.bump(`${rule.id}|${g}|${week}|`);
        this.bump(`${rule.id}|${g}|${week}|${age}`);
      }
    }
    if (row.classi_fin === 1 && row.tp_flu_pcr === 1) {
      this.compDen.set(week, (this.compDen.get(week) ?? 0) + 1);
      if (row.pcr_fluasu === 1 || row.pcr_fluasu === 2) this.compNum.set(week, (this.compNum.get(week) ?? 0) + 1);
    }
  }

  /** Emite zeros explícitos para toda célula no intervalo [SE1, maxWeek]. */
  observations(snapshotId: string): Observation[] {
    const out: Observation[] = [];
    if (this.maxWeek === 0) return out;
    const geos: Array<{ code: string; level: 'country' | 'state' }> = [
      { code: 'BRA', level: 'country' },
      ...[...BR_STATE_BY_UF.values()].map((s) => ({ code: stateGeoCode(s.uf), level: 'state' as const })),
    ];
    const natFlags = this.rowsUfIgnored > 0 ? ['uf_ignored'] : [];
    for (let week = 1; week <= this.maxWeek; week++) {
      const period = weekPeriodId(this.year, week);
      const update_status: UpdateStatus = week > this.maxWeek - PROVISIONAL_WEEKS ? 'provisional' : 'final';
      for (const rule of COUNT_RULES) {
        for (const g of geos) {
          const base = { snapshot_id: snapshotId, indicator_id: rule.id, geo_level: g.level, geo_code: g.code, period_type: 'epiweek' as const, period, update_status };
          out.push(makeObs({ ...base, value: this.cells.get(`${rule.id}|${g.code}|${week}|`) ?? 0, stratum: {}, quality_flags: g.code === 'BRA' ? natFlags : [] }));
          for (const age of AGE_GROUPS) {
            out.push(makeObs({ ...base, value: this.cells.get(`${rule.id}|${g.code}|${week}|${age}`) ?? 0, stratum: { age_group: age } }));
          }
        }
      }
      const den = this.compDen.get(week) ?? 0;
      const num = this.compNum.get(week) ?? 0;
      out.push(makeObs({
        snapshot_id: snapshotId, indicator_id: COMPLETENESS_ID, geo_level: 'country', geo_code: 'BRA', period_type: 'epiweek', period,
        value: den >= 20 ? Math.round((100 * num / den) * 1000) / 1000 : null, denominator: den, stratum: {}, update_status,
      }));
    }
    return out;
  }

  summary(): Record<string, number> {
    return {
      rows_total: this.rowsTotal, rows_used: this.rowsUsed, rows_uf_ignored: this.rowsUfIgnored, rows_no_date: this.rowsNoDate,
      rows_outside_year: this.rowsOutsideYear, rows_sem_pri_mismatch: this.rowsWeekMismatch, max_week: this.maxWeek,
    };
  }
}

export interface SivepNormalizeResult { observations: Observation[]; summary: Record<string, number>; maxWeek: number }

/** Lê o CSV em streaming (csv-parse) e agrega; microdados nunca são persistidos. */
export async function aggregateSivepCsv(path: string, year: number, maxRows?: number, onProgress?: (n: number) => void): Promise<SivepNormalizeResult> {
  const agg = new Aggregator(year);
  const parser = createReadStream(path).pipe(parse({
    delimiter: ';', columns: true, relax_quotes: true, bom: true, relax_column_count: true, skip_empty_lines: true, trim: true,
  }));
  let n = 0;
  for await (const rec of parser as AsyncIterable<Record<string, string>>) {
    n++;
    agg.add(rec);
    if (onProgress && n % 100_000 === 0) onProgress(n);
    if (maxRows && n >= maxRows) { parser.destroy(); break; }
  }
  return { observations: agg.observations(''), summary: agg.summary(), maxWeek: agg.maxWeek };
}

export const sivepConnector: Connector = {
  id: 'sivep',
  sourceId: 'BR-03',
  indicators: SIVEP_INDICATORS,

  async fetch(ctx: FetchContext): Promise<RawSnapshot> {
    const year = ctx.options.year;
    if (!year) throw new Error('sivep: informe --year <aaaa>');
    const html = await fetchText(SIVEP_DATASET_URL, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; h1n1-observatorio)' } });
    const url = findSivepUrl(html, year);
    if (!url) throw new Error(`sivep: nenhuma URL INFLUD para ${year} encontrada em ${SIVEP_DATASET_URL}`);
    ctx.log(`[sivep] URL descoberta: ${url}`);
    const fetched_at = new Date().toISOString();
    const path = join(ctx.tmpDir, `sivep_${year}_${Date.now()}.csv`);
    const d = await downloadToFile(url, path);
    return {
      url, urls: [SIVEP_DATASET_URL, url], path, ext: 'csv', sha256: d.sha256, bytes: d.bytes, content_type: d.content_type ?? 'text/csv',
      license: SIVEP_LICENSE, data_as_of: dataAsOfFromUrl(url), fetched_at, extra: { year, microdata: 'não persistidos; agregados em streaming' },
    };
  },

  async normalize(raw: RawSnapshot, ctx: NormalizeContext): Promise<Observation[]> {
    const year = ctx.options.year ?? Number((raw.extra?.year as number | undefined) ?? NaN);
    if (!Number.isInteger(year)) throw new Error('sivep: ano desconhecido');
    const maxRows = ctx.options.maxRows ?? (process.env.SIVEP_MAX_ROWS ? Number(process.env.SIVEP_MAX_ROWS) : undefined);
    if (maxRows) ctx.log(`[sivep] limite de desenvolvimento: ${maxRows} linhas`);
    const r = await aggregateSivepCsv(raw.path, year, maxRows, (n) => ctx.log(`[sivep] ${n} linhas lidas…`));
    ctx.countRowsIn(r.summary.rows_total ?? 0);
    Object.assign(ctx.report, r.summary, { year, max_rows: maxRows ?? null });
    for (const o of r.observations) o.snapshot_id = ctx.snapshotId;
    if (r.maxWeek > 0) {
      for (const id of SIVEP_INDICATORS) ctx.setCoverage(id, weekPeriodId(year, 1), weekPeriodId(year, 53));
    }
    ctx.log(`[sivep] ${r.summary.rows_total} linhas; ${r.summary.rows_uf_ignored} sem UF válida; ${r.summary.rows_no_date} sem data/semana; ${r.summary.rows_outside_year} fora do ano ${year}; última SE ${r.maxWeek}`);
    return r.observations;
  },
};
