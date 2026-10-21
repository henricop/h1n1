import { describe, it, expect } from 'vitest';
import { parseFlexibleDate, addDays, toInt, percent, parseYearRange } from '../src/util.js';
import { maxDataAsOf } from '../src/pipeline.js';

describe('parseFlexibleDate', () => {
  it('ISO com hora, ISO só data e dd/mm/aaaa (com e sem zero à esquerda) viram a mesma data UTC', () => {
    const iso = parseFlexibleDate('2026-03-05T00:00:00.000Z')!;
    expect(iso.toISOString()).toBe('2026-03-05T00:00:00.000Z');
    expect(parseFlexibleDate('2026-03-05')!.getTime()).toBe(iso.getTime());
    expect(parseFlexibleDate('05/03/2026')!.getTime()).toBe(iso.getTime());
    expect(parseFlexibleDate('5/3/2026')!.getTime()).toBe(iso.getTime());
    expect(parseFlexibleDate('  05/03/2026 ')!.getTime()).toBe(iso.getTime());
    expect(parseFlexibleDate('2026-03-05 10:20:30')!.getTime()).toBe(iso.getTime());
  });
  it('vazio, nulo, formato desconhecido e mês/dia inválidos → null (ou data normalizada pelo Date UTC)', () => {
    expect(parseFlexibleDate('')).toBeNull();
    expect(parseFlexibleDate('   ')).toBeNull();
    expect(parseFlexibleDate(null)).toBeNull();
    expect(parseFlexibleDate(undefined)).toBeNull();
    expect(parseFlexibleDate('03-05-2026')).toBeNull();
    expect(parseFlexibleDate('2026/03/05')).toBeNull();
    expect(parseFlexibleDate('abc')).toBeNull();
    expect(parseFlexibleDate('20260305')).toBeNull();
  });
  it('dd/mm/aaaa não é confundido com mm/dd/aaaa', () => {
    expect(parseFlexibleDate('12/01/2026')!.toISOString()).toBe('2026-01-12T00:00:00.000Z');
  });
});

describe('util', () => {
  it('addDays e toInt', () => {
    expect(addDays('2026-12-28', 6)).toBe('2027-01-03');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(toInt(' 7 ')).toBe(7);
    expect(toInt('')).toBeNull();
    expect(toInt('x')).toBeNull();
    expect(toInt(null)).toBeNull();
  });
  it('percent com denominador mínimo e numerador > denominador', () => {
    expect(percent(5, 10, 20)!.value).toBeNull();
    expect(percent(5, 20, 20)!.value).toBe(25);
    expect(percent(30, 25, 20)).toMatchObject({ value: null, quality_flags: ['numerator_exceeds_denominator'] });
    expect(percent(null, 25, 20)).toBeNull();
  });
  it('parseYearRange', () => {
    expect(parseYearRange('2021-2023,2025')).toEqual([2021, 2022, 2023, 2025]);
    expect(() => parseYearRange('21')).toThrow();
  });
  it('maxDataAsOf nunca retrocede a data da publicação', () => {
    expect(maxDataAsOf('2026-10-19', '2026-09-01')).toBe('2026-10-19');
    expect(maxDataAsOf('2026-09-01', '2026-10-19')).toBe('2026-10-19');
    expect(maxDataAsOf(null, '2026-10-19')).toBe('2026-10-19');
    expect(maxDataAsOf('2026-10-19', null)).toBe('2026-10-19');
    expect(maxDataAsOf(null, null)).toBeNull();
  });
});
