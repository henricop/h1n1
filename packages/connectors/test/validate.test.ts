import { describe, it, expect } from 'vitest';
import { validateObservations, Validator } from '../src/validate.js';
import { makeObs } from '../src/util.js';
import type { Observation } from '@h1n1/core';

const geo = new Set(['BRA', 'BR-SP']);
const mk = (n: number, value: number | null = 1) =>
  Array.from({ length: n }, (_, i) => makeObs({ indicator_id: 'flunet_ah1n1pdm09_detections', snapshot_id: 's', geo_level: 'country', geo_code: 'BRA', period_type: 'isoweek', period: `2026-W${String(i + 1).padStart(2, '0')}`, value }));

describe('validate', () => {
  it('aceita série válida', () => {
    const r = validateObservations(mk(10), { validGeoCodes: geo, previousCounts: new Map() });
    expect(r.ok).toBe(true);
    expect(r.total).toBe(10);
  });
  it('rejeita valor negativo e NaN', () => {
    const obs = mk(3);
    obs[1]!.value = -1;
    obs[2]!.value = Number.NaN;
    const r = validateObservations(obs, { validGeoCodes: geo, previousCounts: new Map() });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/negativo/);
    expect(r.errors.join(' ')).toMatch(/NaN/);
  });
  it('rejeita queda > 10% em relação à publicação vigente, aceita 90%', () => {
    const prev = new Map([['flunet_ah1n1pdm09_detections', 40]]);
    expect(validateObservations(mk(35), { validGeoCodes: geo, previousCounts: prev }).ok).toBe(false);
    expect(validateObservations(mk(36), { validGeoCodes: geo, previousCounts: prev }).ok).toBe(true);
  });
  it('rejeita período inválido, geo desconhecida, period_type divergente e estrato fora do schema', () => {
    const obs = mk(2);
    obs[0]!.period = '2026-W60';
    obs[1]!.geo_code = 'XXX';
    const r = validateObservations(obs, { validGeoCodes: geo, previousCounts: new Map() });
    expect(r.errors.join(' ')).toMatch(/período/);
    expect(r.errors.join(' ')).toMatch(/geo_code/);
    const bad = makeObs({ indicator_id: 'flunet_ah1n1pdm09_detections', snapshot_id: 's', geo_level: 'country', geo_code: 'BRA', period_type: 'epiweek', period: '2026-W01', value: 1, stratum: { origin_source: 'OUTRA' } });
    const r2 = validateObservations([bad], { validGeoCodes: geo, previousCounts: new Map() });
    expect(r2.errors.join(' ')).toMatch(/period_type/);
    expect(r2.errors.join(' ')).toMatch(/estrato/);
  });
  it('percentuais: 0..100 e denominador obrigatório', () => {
    const ok = makeObs({ indicator_id: 'flunet_influenza_positivity', snapshot_id: 's', geo_level: 'country', geo_code: 'BRA', period_type: 'isoweek', period: '2026-W01', value: 50, denominator: 100 });
    expect(validateObservations([ok], { validGeoCodes: geo, previousCounts: new Map() }).ok).toBe(true);
    const over = { ...ok, value: 101 };
    expect(validateObservations([over], { validGeoCodes: geo, previousCounts: new Map() }).errors.join(' ')).toMatch(/0\.\.100/);
    const noDen = { ...ok, denominator: null };
    expect(validateObservations([noDen], { validGeoCodes: geo, previousCounts: new Map() }).errors.join(' ')).toMatch(/denominador/);
  });
  it('indicador esperado sem observações é erro', () => {
    const r = validateObservations([], { validGeoCodes: geo, previousCounts: new Map() }, ['flunet_ah3_detections']);
    expect(r.ok).toBe(false);
  });
});

const sv = (id: string, geo: string, value: number, stratum: Record<string, string> = {}, period = '2026-W10'): Observation =>
  makeObs({ indicator_id: `sivep_srag_${id}`, snapshot_id: 's', geo_level: geo === 'BRA' ? 'country' : 'state', geo_code: geo, period_type: 'epiweek', period, value, stratum });
const fl = (id: string, value: number, stratum: Record<string, string> = {}): Observation =>
  makeObs({ indicator_id: `flunet_${id}`, snapshot_id: 's', geo_level: 'country', geo_code: 'BRA', period_type: 'isoweek', period: '2026-W10', value, stratum });
const AGES = ['0-4', '5-14', '15-29', '30-49', '50-64', '65+', 'NA'];
const ctx = { validGeoCodes: new Set(['BRA', 'BR-SP', 'BR-RJ']), previousCounts: new Map<string, number>() };

/** Célula SIVEP consistente: total + estratos para os 8 indicadores de contagem, BRA e BR-SP. */
function sivepCell(): Observation[] {
  const vals: Record<string, number> = { notifications: 20, influenza_confirmed: 10, ah1n1pdm09_confirmed: 6, ah3n2_confirmed: 2, inf_a_not_subtyped: 1, influenza_deaths: 3, ah1n1pdm09_deaths: 2, influenza_icu: 4 };
  const out: Observation[] = [];
  for (const geo of ['BRA', 'BR-SP']) {
    for (const [id, v] of Object.entries(vals)) {
      const total = geo === 'BRA' ? v : Math.floor(v / 2);
      out.push(sv(id, geo, total));
      AGES.forEach((a, i) => out.push(sv(id, geo, i === 0 ? total : 0, { age_group: a })));
    }
  }
  return out;
}

describe('validate: invariantes cruzadas', () => {
  it('SIVEP consistente passa', () => {
    const r = validateObservations(sivepCell(), ctx);
    expect(r.cross_checks).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('SIVEP: ah1n1pdm09_confirmed > influenza_confirmed e influenza_confirmed > notifications → quarentena com detalhes', () => {
    const obs = sivepCell();
    obs.find((o) => o.indicator_id === 'sivep_srag_ah1n1pdm09_confirmed' && o.geo_code === 'BRA' && !o.stratum.age_group)!.value = 11;
    const r = validateObservations(obs, ctx);
    expect(r.ok).toBe(false);
    expect(r.cross_checks.map((c) => c.rule)).toContain('sivep: ah1n1pdm09_confirmed ≤ influenza_confirmed');
    expect(r.cross_checks[0]!.samples[0]).toMatch(/BRA\|2026-W10/);
    expect(r.errors.join(' ')).toMatch(/invariante cruzada/);
    const obs2 = sivepCell();
    obs2.find((o) => o.indicator_id === 'sivep_srag_influenza_confirmed' && o.geo_code === 'BR-SP' && o.stratum.age_group === '0-4')!.value = 99;
    const r2 = validateObservations(obs2, ctx);
    expect(r2.cross_checks.map((c) => c.rule)).toContain('sivep: influenza_confirmed ≤ notifications');
    // o mesmo erro também quebra a soma dos estratos
    expect(r2.cross_checks.map((c) => c.rule)).toContain('sivep: soma dos estratos age_group = total');
  });

  it('SIVEP: óbitos H1N1 ≤ óbitos influenza ≤ confirmados; UTI ≤ confirmados', () => {
    const obs = sivepCell();
    obs.find((o) => o.indicator_id === 'sivep_srag_ah1n1pdm09_deaths' && o.geo_code === 'BRA' && !o.stratum.age_group)!.value = 4;
    obs.find((o) => o.indicator_id === 'sivep_srag_influenza_icu' && o.geo_code === 'BRA' && !o.stratum.age_group)!.value = 11;
    const rules = validateObservations(obs, ctx).cross_checks.map((c) => c.rule);
    expect(rules).toContain('sivep: ah1n1pdm09_deaths ≤ influenza_deaths');
    expect(rules).toContain('sivep: influenza_icu ≤ influenza_confirmed');
    const obs2 = sivepCell();
    obs2.find((o) => o.indicator_id === 'sivep_srag_influenza_deaths' && o.geo_code === 'BRA' && !o.stratum.age_group)!.value = 11;
    expect(validateObservations(obs2, ctx).cross_checks.map((c) => c.rule)).toContain('sivep: influenza_deaths ≤ influenza_confirmed');
  });

  it('SIVEP: soma dos estratos age_group ≠ total → erro', () => {
    const obs = sivepCell();
    obs.find((o) => o.indicator_id === 'sivep_srag_notifications' && o.geo_code === 'BRA' && o.stratum.age_group === 'NA')!.value = 1;
    const r = validateObservations(obs, ctx);
    const v = r.cross_checks.find((c) => c.rule === 'sivep: soma dos estratos age_group = total')!;
    expect(v.count).toBe(1);
    expect(v.samples[0]).toMatch(/21 ≠ 20/);
  });

  it('SIVEP: soma das UFs > total nacional → erro', () => {
    const obs = sivepCell();
    // BR-RJ com 15 notificações: 15 + 10 (SP) > 20 (BRA)
    obs.push(sv('notifications', 'BR-RJ', 15));
    AGES.forEach((a, i) => obs.push(sv('notifications', 'BR-RJ', i === 0 ? 15 : 0, { age_group: a })));
    const r = validateObservations(obs, ctx);
    const v = r.cross_checks.find((c) => c.rule === 'sivep: soma das UFs ≤ total nacional')!;
    expect(v).toBeTruthy();
    expect(v.samples.join(' ')).toMatch(/25 > 20/);
  });

  it('FluNet: subtipos > inf_a e inf_all < inf_a → erro; só avalia quando todos presentes', () => {
    const ok = [fl('ah1n1pdm09_detections', 5), fl('ah3_detections', 3), fl('inf_a_not_subtyped', 1), fl('inf_a_not_subtypable', 1), fl('inf_a_detections', 10), fl('inf_all_detections', 12)];
    expect(validateObservations(ok, ctx).cross_checks).toEqual([]);
    const bad = ok.map((o) => ({ ...o }));
    bad[4]!.value = 9;
    const r = validateObservations(bad, ctx);
    expect(r.ok).toBe(false);
    expect(r.cross_checks.map((c) => c.rule)).toContain('flunet: ah1n1pdm09 + ah3 + not_subtyped + not_subtypable ≤ inf_a');
    const bad2 = ok.map((o) => ({ ...o }));
    bad2[5]!.value = 9;
    expect(validateObservations(bad2, ctx).cross_checks.map((c) => c.rule)).toContain('flunet: inf_a ≤ inf_all');
    // sem ANOTSUBTYPABLE a regra dos subtipos não é avaliada (termos ausentes), mas inf_all ≥ inf_a continua
    const partial = [fl('ah1n1pdm09_detections', 50), fl('ah3_detections', 3), fl('inf_a_not_subtyped', 1), fl('inf_a_detections', 10), fl('inf_all_detections', 12)];
    expect(validateObservations(partial, ctx).cross_checks).toEqual([]);
    // estratos são células distintas: um estrato inconsistente é detectado isoladamente
    const strat = [...ok, fl('inf_a_detections', 10, { origin_source: 'SENTINEL' }), fl('inf_all_detections', 2, { origin_source: 'SENTINEL' })];
    expect(validateObservations(strat, ctx).cross_checks.find((c) => c.rule === 'flunet: inf_a ≤ inf_all')!.samples[0]).toMatch(/origin_source=SENTINEL/);
  });

  it('erro reportado pelo conector (addError) falha a validação', () => {
    const v = new Validator(ctx, []);
    v.add(mk(3));
    v.addError('2 linha(s) duplicada(s)');
    const r = v.finish();
    expect(r.ok).toBe(false);
    expect(r.connector_errors).toEqual(['2 linha(s) duplicada(s)']);
    expect(r.errors.join(' ')).toMatch(/conector: 2 linha/);
  });

  it('sivep_reporting_delay_cdf: 13 estratos por (geo, período), não decrescente em delay_weeks, 0..100', () => {
    const cdf = (values: Array<number | null>, geo = 'BRA') => values.map((v, d) => makeObs({
      indicator_id: 'sivep_reporting_delay_cdf', snapshot_id: 's', geo_level: geo === 'BRA' ? 'country' : 'state', geo_code: geo,
      period_type: 'year', period: '2026', value: v, denominator: 500, stratum: { delay_weeks: String(d) },
    }));
    const okVals = [10, 30, 50, 60, 70, 80, 85, 90, 95, 97, 98, 99, 100];
    expect(validateObservations(cdf(okVals), { validGeoCodes: geo, previousCounts: new Map() }).ok).toBe(true);
    // nulos (n < min_denominator) são ignorados na monotonia
    expect(validateObservations(cdf(okVals.map(() => null)), { validGeoCodes: geo, previousCounts: new Map() }).ok).toBe(true);
    const bad = cdf([10, 30, 20, 60, 70, 80, 85, 90, 95, 97, 98, 99, 100]);
    const r = validateObservations(bad, { validGeoCodes: geo, previousCounts: new Map() });
    expect(r.ok).toBe(false);
    expect(r.cross_checks.map((c) => c.rule)).toContain('sivep: delay_cdf não decrescente em delay_weeks');
    expect(r.cross_checks[0]!.samples[0]).toMatch(/country\|BRA\|2026: d=2 20 < 30/);
    const missing = cdf(okVals).filter((o) => o.stratum.delay_weeks !== '5');
    const r2 = validateObservations(missing, { validGeoCodes: geo, previousCounts: new Map() });
    expect(r2.cross_checks.map((c) => c.rule)).toContain('sivep: delay_cdf com estratos delay_weeks ausentes');
    const over = cdf([...okVals.slice(0, 12), 101]);
    expect(validateObservations(over, { validGeoCodes: geo, previousCounts: new Map() }).errors.join(' ')).toMatch(/fora de 0..100/);
    const badType = cdf(okVals).map((o) => ({ ...o, period_type: 'epiweek' as const, period: '2026-W01' }));
    expect(validateObservations(badType, { validGeoCodes: geo, previousCounts: new Map() }).errors.join(' ')).toMatch(/period_type/);
  });
});
