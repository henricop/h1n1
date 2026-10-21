import { getIndicator, type IndicatorDefinition, type Observation } from '@h1n1/core';

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

export interface ValidationReport {
  ok: boolean;
  total: number;
  indicators: Record<string, IndicatorReport>;
  errors: string[];
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
  constructor(private readonly ctx: ValidationContext, private readonly expected: string[] = []) {}

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
    return { ok: errors.length === 0, total, indicators, errors };
  }
}

/** Conveniência: valida um array completo de observações. */
export function validateObservations(obs: Observation[], ctx: ValidationContext, expected: string[] = []): ValidationReport {
  const v = new Validator(ctx, expected);
  v.add(obs);
  return v.finish();
}
