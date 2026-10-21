import { describe, it, expect } from 'vitest';
import { validateObservations } from '../src/validate.js';
import { makeObs } from '../src/util.js';

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
