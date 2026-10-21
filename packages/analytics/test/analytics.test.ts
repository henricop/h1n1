import { describe, it, expect } from 'vitest';
import { ears, nowcast, seasonOverlay, trend } from '../src/index.js';

describe('ears', () => {
  it('sinaliza C1/C2/C3 em um pico sobre baseline estável e devolve null sem baseline completa', () => {
    const base = [10, 12, 11, 9, 10, 11, 12, 10, 11, 10, 9, 11];
    const series = [...base, 40, 45, 50];
    const r = ears(series, { baseline: 8, guard: 2 });
    expect(r).toHaveLength(series.length);
    for (let i = 0; i < 8; i++) expect(r[i]).toBeNull();
    // t = 8: C1 computável (baseline 0..7), C2 ainda não (precisa de 10 posições)
    expect(r[8]!.c1).not.toBeNull();
    expect(r[8]!.c2).toBeNull();
    expect(r[8]!.flags).toEqual([]);
    const peak = r[12]!;
    expect(peak.c1!).toBeGreaterThan(3);
    expect(peak.c2!).toBeGreaterThan(3);
    expect(peak.flags).toContain('C1');
    expect(peak.flags).toContain('C2');
    const last = r[14]!;
    expect(last.c3!).toBeGreaterThan(2);
    expect(last.flags).toContain('C3');
  });

  it('sd zero: 0 quando x_t <= média, 100 quando acima; nulls são pulados ou anulam o ponto', () => {
    const flat = [5, 5, 5, 5, 5, 5, 5, 5, 5, 9];
    const r = ears(flat, { baseline: 8, guard: 0 });
    expect(r[8]).toMatchObject({ c1: 0, c2: 0 });
    expect(r[9]).toMatchObject({ c1: 100, c2: 100, flags: ['C1', 'C2'] });
    const withNull = [5, 5, null, 5, 5, 5, 5, 5, 5, null];
    const r2 = ears(withNull, { baseline: 8, guard: 0 });
    expect(r2[8]!.c1).toBe(0);
    expect(r2[9]).toBeNull();
  });

  it('respeita limiares customizados', () => {
    const series = [10, 10, 10, 10, 10, 10, 10, 10, 12];
    const r = ears(series, { baseline: 8, guard: 0, thresholds: { c1: 50 } });
    expect(r[8]!.c1).toBe(100);
    expect(r[8]!.flags).toEqual(['C1', 'C2']);
    const r2 = ears(series, { baseline: 8, guard: 0, thresholds: { c1: 150, c2: 150 } });
    expect(r2[8]!.flags).toEqual([]);
  });
});

describe('nowcast', () => {
  const cdf = [20, 50, 70, 85, 92, 95, 97, 98, 99, 99.5, 99.8, 100, 100];
  it('corrige pela share e devolve intervalo binomial; semanas completas saem sem intervalo', () => {
    const r = nowcast(
      [
        { period: '2026-W40', value: 10, weeksAgo: 0 },
        { period: '2026-W38', value: 70, weeksAgo: 2 },
        { period: '2026-W30', value: 100, weeksAgo: 10 },
        { period: '2026-W20', value: 100, weeksAgo: 20 },
      ],
      cdf,
      400,
    );
    expect(r[0]).toMatchObject({ period: '2026-W40', weeks_ago: 0, observed: 10, reported_share: 0.2, estimated: 50 });
    expect(r[0]!.lower!).toBeLessThan(50);
    expect(r[0]!.upper!).toBeGreaterThan(50);
    expect(r[1]!.estimated).toBe(100);
    expect(r[2]).toMatchObject({ reported_share: 0.998, estimated: 100, lower: null, upper: null });
    expect(r[3]).toMatchObject({ weeks_ago: 20, reported_share: 1, estimated: 100 });
  });
  it('observado null → sem estimativa; n <= 0 → sem intervalo; cdf curta → erro', () => {
    const r = nowcast([{ period: '2026-W40', value: null, weeksAgo: 0 }], cdf, 400);
    expect(r[0]).toMatchObject({ observed: null, estimated: null, lower: null, upper: null });
    const r2 = nowcast([{ period: '2026-W40', value: 10, weeksAgo: 0 }], cdf, 0);
    expect(r2[0]).toMatchObject({ estimated: 50, lower: null, upper: null });
    expect(() => nowcast([], [1, 2, 3], 10)).toThrow();
  });
});

describe('seasonOverlay', () => {
  it('uma linha por ano com 53 semanas; semanas ausentes null; períodos inválidos ignorados', () => {
    const r = seasonOverlay([
      { period: '2025-W01', value: 1 },
      { period: '2025-W53', value: 3 },
      { period: '2024-W10', value: 7 },
      { period: '2024-M01', value: 99 },
      { period: '2024-W60', value: 99 },
    ]);
    expect(r.weeks).toHaveLength(53);
    expect(r.weeks[0]).toBe(1);
    expect(r.weeks[52]).toBe(53);
    expect(r.seasons.map((s) => s.year)).toEqual([2024, 2025]);
    expect(r.seasons[0]!.values[9]).toBe(7);
    expect(r.seasons[1]!.values[0]).toBe(1);
    expect(r.seasons[1]!.values[52]).toBe(3);
    expect(r.seasons[1]!.values[1]).toBeNull();
    expect(JSON.stringify(r)).not.toContain('99');
  });
});

describe('trend', () => {
  it('variação percentual entre médias; null quando insuficiente ou base zero', () => {
    expect(trend([10, 10, 10, 10, 20, 20, 20, 20], 4)).toBe(100);
    expect(trend([10, 10, 5, 5], 2)).toBe(-50);
    expect(trend([1, 2, 3], 2)).toBeNull();
    expect(trend([0, 0, 1, 1], 2)).toBeNull();
    expect(trend([10, null, 20, null], 2)).toBe(100);
    expect(trend([null, null, 1, 1], 2)).toBeNull();
  });
});
