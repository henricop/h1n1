import { getIndicator, stratumKey, type IndicatorDefinition, type Observation } from '@h1n1/core';

export const PERIOD_RE: Record<string, RegExp> = {
  epiweek: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/,
  isoweek: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/,
  month: /^\d{4}-M(0[1-9]|1[0-2])$/,
  year: /^\d{4}$/,
};

/** Fração mínima de observações em relação à última publicação vigente (queda abrupta → quarentena). */
export const MIN_COUNT_RATIO = 0.9;

export interface ValidationContext {
  /** códigos geo existentes na tabela geo */
  validGeoCodes: ReadonlySet<string>;
  /** contagem de observações da publicação vigente por indicador (null = sem publicação anterior) */
  previousCounts: ReadonlyMap<string, number>;
}

export interface IndicatorReport {
  indicator_id: string;
  count: number;
  previous_count: number | null;
  errors: string[];
  samples: string[];
  ok: boolean;
  null_values: number;
}

export interface CrossCheckViolation {
  rule: string;
  count: number;
  samples: string[];
}

export interface ValidationReport {
  ok: boolean;
  total: number;
  indicators: Record<string, IndicatorReport>;
  /** invariantes cruzadas entre indicadores da mesma célula (geo, período, estrato) */
  cross_checks: CrossCheckViolation[];
  /** erros reportados pelo conector (ctx.addError) */
  connector_errors: string[];
  errors: string[];
}

/** Regra cruzada: `a ≤ b` ou `a + b + … ≤ c` dentro da mesma célula; só avaliada quando todos os termos existem. */
interface CrossRule {
  name: string;
  /** ids somados do lado esquerdo */
  lhs: string[];
  /** id do lado direito */
  rhs: string;
}

const S = (x: string) => `sivep_srag_${x}`;
const F = (x: string) => `flunet_${x}`;

/** Invariantes por célula (geo, período, estrato). */
export const CROSS_RULES: readonly CrossRule[] = [
  { name: 'sivep: ah1n1pdm09_confirmed ≤ influenza_confirmed', lhs: [S('ah1n1pdm09_confirmed')], rhs: S('influenza_confirmed') },
  { name: 'sivep: influenza_confirmed ≤ notifications', lhs: [S('influenza_confirmed')], rhs: S('notifications') },
  { name: 'sivep: ah1n1pdm09_deaths ≤ influenza_deaths', lhs: [S('ah1n1pdm09_deaths')], rhs: S('influenza_deaths') },
  { name: 'sivep: influenza_deaths ≤ influenza_confirmed', lhs: [S('influenza_deaths')], rhs: S('influenza_confirmed') },
  { name: 'sivep: influenza_icu ≤ influenza_confirmed', lhs: [S('influenza_icu')], rhs: S('influenza_confirmed') },
  { name: 'flunet: ah1n1pdm09 + ah3 + not_subtyped + not_subtypable ≤ inf_a', lhs: [F('ah1n1pdm09_detections'), F('ah3_detections'), F('inf_a_not_subtyped'), F('inf_a_not_subtypable')], rhs: F('inf_a_detections') },
  { name: 'flunet: inf_a ≤ inf_all', lhs: [F('inf_a_detections')], rhs: F('inf_all_detections') },
];

/** Indicadores de contagem do SIVEP: soma dos estratos age_group = total; soma das UFs ≤ total nacional. */
export const SIVEP_COUNT_INDICATORS: readonly string[] = [
  'notifications', 'influenza_confirmed', 'ah1n1pdm09_confirmed', 'ah3n2_confirmed', 'inf_a_not_subtyped',
  'influenza_deaths', 'ah1n1pdm09_deaths', 'influenza_icu',
].map(S);
export const SIVEP_STRATUM_DIMENSION = 'age_group';
const SIVEP_NATIONAL = 'BRA';
/** CDF do atraso de notificação: por (geo, período) os 13 valores delay_weeks=0..12 devem existir e ser não decrescentes. */
export const DELAY_CDF_INDICATOR = 'sivep_reporting_delay_cdf';
export const DELAY_CDF_DIMENSION = 'delay_weeks';
export const DELAY_CDF_MAX_D = 12;

const CROSS_INDICATORS: ReadonlySet<string> = new Set([
  ...CROSS_RULES.flatMap((r) => [...r.lhs, r.rhs]),
  ...SIVEP_COUNT_INDICATORS,
  DELAY_CDF_INDICATOR,
]);

class Violations {
  readonly byRule = new Map<string, CrossCheckViolation>();
  add(rule: string, sample: string) {
    let v = this.byRule.get(rule);
    if (!v) { v = { rule, count: 0, samples: [] }; this.byRule.set(rule, v); }
    v.count++;
    if (v.samples.length < 5) v.samples.push(sample);
  }
  list(): CrossCheckViolation[] { return [...this.byRule.values()]; }
}

/**
 * Invariantes cruzadas entre indicadores. Guarda apenas valores dos indicadores participantes,
 * por célula (geo_level, geo_code, período, estrato) — nunca linhas individuais.
 */
export class CrossValidator {
  /** cellKey → indicator_id → value */
  private cells = new Map<string, Map<string, number | null>>();
  private seen = new Set<string>();

  add(o: Observation): void {
    if (!CROSS_INDICATORS.has(o.indicator_id)) return;
    this.seen.add(o.indicator_id);
    const key = `${o.geo_level}|${o.geo_code}|${o.period}|${stratumKey(o.stratum)}`;
    let cell = this.cells.get(key);
    if (!cell) { cell = new Map(); this.cells.set(key, cell); }
    cell.set(o.indicator_id, o.value);
  }

  finish(): CrossCheckViolation[] {
    const v = new Violations();
    // (1) regras por célula
    for (const [key, cell] of this.cells) {
      for (const rule of CROSS_RULES) {
        const rhs = cell.get(rule.rhs);
        if (rhs === undefined || rhs === null) continue;
        let sum = 0; let complete = true;
        for (const id of rule.lhs) {
          const x = cell.get(id);
          if (x === undefined || x === null) { complete = false; break; }
          sum += x;
        }
        if (!complete) continue;
        if (sum > rhs) v.add(rule.name, `${key}: ${sum} > ${rhs}`);
      }
    }
    // (2) SIVEP: soma dos estratos age_group = total; soma das UFs ≤ nacional
    const sivepIds = SIVEP_COUNT_INDICATORS.filter((id) => this.seen.has(id));
    if (sivepIds.length) {
      // totals: indicator|geo_level|geo|period → value (estrato vazio); strata sums: indicator|geo_level|geo|period → soma
      const totals = new Map<string, number>();
      const strataSum = new Map<string, number>();
      const ufSum = new Map<string, number>(); // indicator|period|stratum → soma das UFs
      const natByStratum = new Map<string, number>(); // indicator|period|stratum → valor nacional
      for (const [key, cell] of this.cells) {
        const [level, geo, period, stratum] = key.split('|') as [string, string, string, string];
        for (const id of sivepIds) {
          const x = cell.get(id);
          if (x === undefined || x === null) continue;
          const cellId = `${id}|${level}|${geo}|${period}`;
          if (stratum === '') totals.set(cellId, x);
          else if (stratum.startsWith(`${SIVEP_STRATUM_DIMENSION}=`)) strataSum.set(cellId, (strataSum.get(cellId) ?? 0) + x);
          const natKey = `${id}|${period}|${stratum}`;
          if (level === 'state') ufSum.set(natKey, (ufSum.get(natKey) ?? 0) + x);
          else if (level === 'country' && geo === SIVEP_NATIONAL) natByStratum.set(natKey, x);
        }
      }
      for (const [cellId, sum] of strataSum) {
        const total = totals.get(cellId);
        if (total === undefined) { v.add('sivep: estratos age_group sem total', `${cellId}: soma ${sum}`); continue; }
        if (sum !== total) v.add('sivep: soma dos estratos age_group = total', `${cellId}: ${sum} ≠ ${total}`);
      }
      for (const [natKey, sum] of ufSum) {
        const nat = natByStratum.get(natKey);
        if (nat === undefined) continue;
        if (sum > nat) v.add('sivep: soma das UFs ≤ total nacional', `${natKey}: ${sum} > ${nat}`);
      }
    }
    // (3) sivep_reporting_delay_cdf: 13 estratos por (geo, período), monotônico não decrescente em d (nulos ignorados)
    if (this.seen.has(DELAY_CDF_INDICATOR)) {
      const series = new Map<string, Array<number | null | undefined>>();
      for (const [key, cell] of this.cells) {
        const x = cell.get(DELAY_CDF_INDICATOR);
        if (x === undefined) continue;
        const [level, geo, period, stratum] = key.split('|') as [string, string, string, string];
        const m = /^delay_weeks=(\d+)$/.exec(stratum);
        if (!m) continue;
        const d = Number(m[1]);
        const sKey = `${level}|${geo}|${period}`;
        let arr = series.get(sKey);
        if (!arr) { arr = new Array(DELAY_CDF_MAX_D + 1).fill(undefined); series.set(sKey, arr); }
        if (d <= DELAY_CDF_MAX_D) arr[d] = x;
      }
      for (const [sKey, arr] of series) {
        const missing: number[] = [];
        for (let d = 0; d <= DELAY_CDF_MAX_D; d++) if (arr[d] === undefined) missing.push(d);
        if (missing.length) v.add('sivep: delay_cdf com estratos delay_weeks ausentes', `${sKey}: faltam d=${missing.join(',')}`);
        let prev: number | null = null;
        for (let d = 0; d <= DELAY_CDF_MAX_D; d++) {
          const x = arr[d];
          if (x === undefined || x === null) continue;
          if (prev !== null && x < prev) { v.add('sivep: delay_cdf não decrescente em delay_weeks', `${sKey}: d=${d} ${x} < ${prev}`); break; }
          prev = x;
        }
      }
    }
    return v.list();
  }
}

interface Acc {
  def: IndicatorDefinition;
  count: number;
  nullValues: number;
  negative: number;
  nan: number;
  badPeriod: number;
  badPeriodType: number;
  badGeo: number;
  badGeoLevel: number;
  outOfRange: number;
  missingDenominator: number;
  badStratum: number;
  samples: string[];
}

function sample(acc: Acc, msg: string) {
  if (acc.samples.length < 5) acc.samples.push(msg);
}

/**
 * Validador incremental: recebe lotes de observações e produz o relatório ao final.
 * Regras mínimas do plano de execução (A8 / regra 10 de integridade).
 */
export class Validator {
  private accs = new Map<string, Acc>();
  private cross = new CrossValidator();
  private connectorErrors: string[] = [];
  constructor(private readonly ctx: ValidationContext, private readonly expected: string[] = []) {}

  /** Erro reportado pelo conector (ctx.addError): falha a validação sem derrubar a execução. */
  addError(msg: string): void { this.connectorErrors.push(msg); }

  private acc(id: string): Acc {
    let a = this.accs.get(id);
    if (!a) {
      a = {
        def: getIndicator(id), count: 0, nullValues: 0, negative: 0, nan: 0, badPeriod: 0, badPeriodType: 0, badGeo: 0,
        badGeoLevel: 0, outOfRange: 0, missingDenominator: 0, badStratum: 0, samples: [],
      };
      this.accs.set(id, a);
    }
    return a;
  }

  add(batch: Iterable<Observation>): void {
    for (const o of batch) {
      const a = this.acc(o.indicator_id);
      a.count++;
      this.cross.add(o);
      const where = `${o.geo_code} ${o.period} [${Object.entries(o.stratum).map(([k, v]) => `${k}=${v}`).join(';')}]`;
      if (o.value === null) a.nullValues++;
      else if (typeof o.value !== 'number' || Number.isNaN(o.value) || !Number.isFinite(o.value)) { a.nan++; sample(a, `NaN em ${where}`); }
      else if (o.value < 0) { a.negative++; sample(a, `valor negativo ${o.value} em ${where}`); }
      else if (a.def.measurement === 'percent' && (o.value < 0 || o.value > 100)) { a.outOfRange++; sample(a, `percentual fora de 0..100 (${o.value}) em ${where}`); }
      if (o.denominator !== null && (Number.isNaN(o.denominator) || o.denominator < 0)) { a.nan++; sample(a, `denominador inválido em ${where}`); }
      const re = PERIOD_RE[o.period_type];
      if (!re || !re.test(o.period)) { a.badPeriod++; sample(a, `período inválido '${o.period}' (${o.period_type})`); }
      if (o.period_type !== a.def.period_type) { a.badPeriodType++; sample(a, `period_type ${o.period_type} ≠ ${a.def.period_type}`); }
      if (!this.ctx.validGeoCodes.has(o.geo_code)) { a.badGeo++; sample(a, `geo_code desconhecido '${o.geo_code}'`); }
      if (!a.def.geo_levels.includes(o.geo_level)) { a.badGeoLevel++; sample(a, `geo_level ${o.geo_level} não permitido`); }
      if (a.def.denominator_indicator_id && o.denominator === null) { a.missingDenominator++; sample(a, `denominador ausente em ${where}`); }
      for (const [k, v] of Object.entries(o.stratum)) {
        const allowed = a.def.stratum_schema[k];
        if (!allowed) { a.badStratum++; sample(a, `dimensão de estrato '${k}' fora do schema`); }
        else if (!allowed.includes(v)) { a.badStratum++; sample(a, `valor de estrato ${k}=${v} fora do schema`); }
      }
    }
  }

  /** @param previousCounts sobrescreve as contagens da publicação vigente (ex.: restritas à cobertura declarada) */
  finish(previousCounts?: ReadonlyMap<string, number>): ValidationReport {
    const prevCounts = previousCounts ?? this.ctx.previousCounts;
    for (const id of this.expected) this.acc(id);
    const indicators: Record<string, IndicatorReport> = {};
    const errors: string[] = [];
    let total = 0;
    for (const [id, a] of this.accs) {
      const errs: string[] = [];
      if (a.count === 0) errs.push('nenhuma observação produzida');
      if (a.negative) errs.push(`${a.negative} valor(es) negativo(s)`);
      if (a.nan) errs.push(`${a.nan} valor(es) NaN/inválido(s)`);
      if (a.badPeriod) errs.push(`${a.badPeriod} período(s) inválido(s)`);
      if (a.badPeriodType) errs.push(`${a.badPeriodType} observação(ões) com period_type divergente da ontologia`);
      if (a.badGeo) errs.push(`${a.badGeo} geo_code(s) inexistente(s) em geo`);
      if (a.badGeoLevel) errs.push(`${a.badGeoLevel} geo_level(s) não permitido(s)`);
      if (a.outOfRange) errs.push(`${a.outOfRange} percentual(is) fora de 0..100`);
      if (a.missingDenominator) errs.push(`${a.missingDenominator} observação(ões) sem denominador`);
      if (a.badStratum) errs.push(`${a.badStratum} estrato(s) fora do stratum_schema`);
      const prev = prevCounts.get(id) ?? null;
      if (prev !== null && prev > 0 && a.count < prev * MIN_COUNT_RATIO) {
        errs.push(`queda abrupta: ${a.count} observações vs ${prev} na publicação vigente (< ${MIN_COUNT_RATIO * 100}%)`);
      }
      total += a.count;
      indicators[id] = { indicator_id: id, count: a.count, previous_count: prev, errors: errs, samples: a.samples, ok: errs.length === 0, null_values: a.nullValues };
      for (const e of errs) errors.push(`${id}: ${e}`);
    }
    const cross_checks = this.cross.finish();
    for (const c of cross_checks) errors.push(`invariante cruzada violada (${c.rule}): ${c.count} célula(s), ex.: ${c.samples.slice(0, 2).join('; ')}`);
    for (const e of this.connectorErrors) errors.push(`conector: ${e}`);
    return { ok: errors.length === 0, total, indicators, cross_checks, connector_errors: [...this.connectorErrors], errors };
  }
}

/** Conveniência: valida um array completo de observações. */
export function validateObservations(obs: Observation[], ctx: ValidationContext, expected: string[] = []): ValidationReport {
  const v = new Validator(ctx, expected);
  v.add(obs);
  return v.finish();
}
