import { describe, it, expect } from 'vitest';
import { applySuppression, stratumKey } from '../src/suppression.js';
import type { Observation } from '../src/types.js';

const base = (over: Partial<Observation>): Observation => ({
  indicator_id: 'x',
  snapshot_id: 's',
  geo_level: 'state',
  geo_code: 'BR-SC',
  period_type: 'epiweek',
  period: '2026-W10',
  period_start: '2026-03-08',
  period_end: '2026-03-14',
  value: 0,
  denominator: null,
  stratum: {},
  update_status: 'provisional',
  quality_flags: [],
  ...over,
});

describe('applySuppression', () => {
  it('suprime células < limiar em recortes estaduais, preserva zeros e totais nacionais', () => {
    const rows = [
      base({ value: 3 }),
      base({ value: 0, geo_code: 'BR-RS' }),
      base({ value: 2, geo_level: 'country', geo_code: 'BRA' }),
    ];
    const out = applySuppression(rows, { threshold: 5 });
    expect(out[0]!.suppressed).toBe(true);
    expect(out[0]!.value).toBeNull();
    expect(out[1]!.suppressed).toBe(false);
    expect(out[2]!.suppressed).toBe(false);
    expect(out[2]!.value).toBe(2);
  });
  it('aplica supressão complementar quando só um estrato foi suprimido e há total', () => {
    const rows = [
      base({ value: 40 }),
      base({ value: 3, stratum: { age_group: '0-4' } }),
      base({ value: 7, stratum: { age_group: '5-14' } }),
      base({ value: 30, stratum: { age_group: '65+' } }),
    ];
    const out = applySuppression(rows, { threshold: 5 });
    const by = (k: string) => out.find((o) => stratumKey(o.stratum) === k)!;
    expect(by('age_group=0-4').suppressed).toBe(true);
    expect(by('age_group=5-14').suppressed).toBe(true);
    expect(by('age_group=65+').suppressed).toBe(false);
    expect(by('').value).toBe(40);
  });
});

describe('stratumKey', () => {
  it('é canônica e ordenada', () => {
    expect(stratumKey({ b: '2', a: '1' })).toBe('a=1;b=2');
    expect(stratumKey({})).toBe('');
  });
});
