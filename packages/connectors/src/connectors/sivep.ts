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
  rowsWeekFromDate = 0;
  rowsAgeUnknown = 0;
  /** semanas com ao menos uma linha sem UF válida (flag uf_ignored no recorte nacional) */
  readonly ufIgnoredWeeks = new Set<number>();

  constructor(year: number) { this.year = year; }

  private bump(key: string) { this.cells.set(key, (this.cells.get(key) ?? 0) + 1); }

  add(rec: Record<string, string>): void {
    this.rowsTotal++;
    // Período: SEM_PRI (semana epidemiológica dos primeiros sintomas) quando válida (1..53); o ano epidemiológico
    // vem de epiWeek(DT_SIN_PRI) quando a data existe (senão, ano do arquivo). DT_SIN_PRI só define a semana
    // quando SEM_PRI é inválida. Divergências SEM_PRI ≠ epiWeek(DT_SIN_PRI).week são contadas (rows_sem_pri_mismatch).
    const dt = parseFlexibleDate(rec.DT_SIN_PRI);
    const epi = dt ? epiWeek(dt) : null;
    const semPri = toInt(rec.SEM_PRI);
    const semValid = semPri !== null && Number.isInteger(semPri) && semPri >= 1 && semPri <= 53;
    let year: number; let week: number;
    if (semValid) {
      week = semPri;
      year = epi ? epi.year : this.year;
      if (epi && epi.week !== semPri) this.rowsWeekMismatch++;
    } else if (epi) {
      ({ year, week } = epi);
      this.rowsWeekFromDate++;
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
    if (!state) { this.rowsUfIgnored++; this.ufIgnoredWeeks.add(week); }
    // Idade: TP_IDADE 1 = dias, 2 = meses (→ 0 anos), 3 = anos. TP_IDADE nulo/inválido ou NU_IDADE_N ausente → 'NA'.
    const idadeN = toInt(rec.NU_IDADE_N);
    const tpIdade = toInt(rec.TP_IDADE);
    let years: number | null = null;
    if (idadeN !== null && idadeN >= 0) {
      if (tpIdade === 3) years = idadeN;
      else if (tpIdade === 1 || tpIdade === 2) years = 0;
    }
    if (years === null) this.rowsAgeUnknown++;
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
    for (let week = 1; week <= this.maxWeek; week++) {
      const period = weekPeriodId(this.year, week);
      const update_status: UpdateStatus = week > this.maxWeek - PROVISIONAL_WEEKS ? 'provisional' : 'final';
      // uf_ignored só nas semanas em que houve linhas sem UF válida, no total nacional e nos seus estratos
      const natFlags = this.ufIgnoredWeeks.has(week) ? ['uf_ignored'] : [];
      for (const rule of COUNT_RULES) {
        for (const g of geos) {
          const base = { snapshot_id: snapshotId, indicator_id: rule.id, geo_level: g.level, geo_code: g.code, period_type: 'epiweek' as const, period, update_status };
          const flags = g.code === 'BRA' ? natFlags : [];
          out.push(makeObs({ ...base, value: this.cells.get(`${rule.id}|${g.code}|${week}|`) ?? 0, stratum: {}, quality_flags: flags }));
          for (const age of AGE_GROUPS) {
            out.push(makeObs({ ...base, value: this.cells.get(`${rule.id}|${g.code}|${week}|${age}`) ?? 0, stratum: { age_group: age }, quality_flags: flags }));
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
      rows_outside_year: this.rowsOutsideYear, rows_sem_pri_mismatch: this.rowsWeekMismatch, rows_week_from_date: this.rowsWeekFromDate,
      rows_age_unknown: this.rowsAgeUnknown, uf_ignored_weeks: this.ufIgnoredWeeks.size, max_week: this.maxWeek,
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

export const SIVEP_RAW_NOTE = 'microdados individuais; apenas agregados são retidos';

export const sivepConnector: Connector = {
  id: 'sivep',
  sourceId: 'BR-03',
  indicators: SIVEP_INDICATORS,
  /** Microdados individuais: o CSV bruto é apagado pelo pipeline após a agregação (só o sidecar .meta.json fica). */
  retainRaw: false,

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
      license: SIVEP_LICENSE, data_as_of: dataAsOfFromUrl(url), fetched_at,
      extra: { year, microdata: `${SIVEP_RAW_NOTE}; agregados em streaming; CSV bruto apagado após a agregação (raw_file_deleted)` },
    };
  },

  async normalize(raw: RawSnapshot, ctx: NormalizeContext): Promise<Observation[]> {
    const year = ctx.options.year ?? Number((raw.extra?.year as number | undefined) ?? NaN);
    if (!Number.isInteger(year)) throw new Error('sivep: ano desconhecido');
    const maxRows = ctx.options.maxRows;
    if (maxRows) ctx.log(`[sivep] AVISO: limite de desenvolvimento ${maxRows} linhas — execução parcial, a snapshot não será publicada`);
    const r = await aggregateSivepCsv(raw.path, year, maxRows, (n) => ctx.log(`[sivep] ${n} linhas lidas…`));
    ctx.countRowsIn(r.summary.rows_total ?? 0);
    Object.assign(ctx.report, r.summary, { year, max_rows: maxRows ?? null });
    for (const o of r.observations) o.snapshot_id = ctx.snapshotId;
    if (r.maxWeek > 0) {
      for (const id of SIVEP_INDICATORS) ctx.setCoverage(id, weekPeriodId(year, 1), weekPeriodId(year, 53));
    }
    ctx.log(`[sivep] ${r.summary.rows_total} linhas; ${r.summary.rows_uf_ignored} sem UF válida (${r.summary.uf_ignored_weeks} semana(s)); ${r.summary.rows_no_date} sem data/semana; ${r.summary.rows_outside_year} fora do ano ${year}; ${r.summary.rows_sem_pri_mismatch} com SEM_PRI ≠ epiWeek(DT_SIN_PRI); ${r.summary.rows_age_unknown} sem idade válida; última SE ${r.maxWeek}`);
    return r.observations;
  },
};
