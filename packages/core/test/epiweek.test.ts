import { describe, it, expect } from 'vitest';
import { isoWeek, epiWeek, mmwrWeek, isoWeekStart, epiWeekStart, mmwrWeekStart, periodBounds, weekPeriodId } from '../src/epiweek.js';

describe('isoWeek', () => {
  it('2026-10-05 é semana ISO 41 de 2026 (FluNet ISO_WEEKSTARTDATE)', () => {
    expect(isoWeek(new Date(Date.UTC(2026, 9, 5)))).toEqual({ year: 2026, week: 41 });
    expect(isoWeekStart(2026, 41).toISOString().slice(0, 10)).toBe('2026-10-05');
  });
  it('2009-07-20 é semana ISO 30 de 2009', () => {
    expect(isoWeek(new Date(Date.UTC(2009, 6, 20)))).toEqual({ year: 2009, week: 30 });
  });
  it('viradas de ano', () => {
    expect(isoWeek(new Date(Date.UTC(2021, 0, 1)))).toEqual({ year: 2020, week: 53 });
    expect(isoWeek(new Date(Date.UTC(2024, 11, 30)))).toEqual({ year: 2025, week: 1 });
  });
});

describe('mmwrWeek (CDC)', () => {
  it('2026-10-04 (domingo) inicia a semana MMWR 40 de 2026 (FluNet MMWR_WEEKSTARTDATE)', () => {
    expect(mmwrWeek(new Date(Date.UTC(2026, 9, 4)))).toEqual({ year: 2026, week: 40 });
    expect(mmwrWeekStart(2026, 40).toISOString().slice(0, 10)).toBe('2026-10-04');
  });
  it('2009-07-19 inicia a semana MMWR 29 de 2009 (CDC: semana 29 termina em 25/07/2009)', () => {
    expect(mmwrWeek(new Date(Date.UTC(2009, 6, 19)))).toEqual({ year: 2009, week: 29 });
  });
});

describe('epiWeek (SE brasileira, SIVEP)', () => {
  it('2026-10-04 (domingo) inicia a SE 41 de 2026 (SE 1 de 2026 começa em 28/12/2025)', () => {
    expect(epiWeek(new Date(Date.UTC(2026, 9, 4)))).toEqual({ year: 2026, week: 41 });
    expect(epiWeekStart(2026, 1).toISOString().slice(0, 10)).toBe('2025-12-28');
    expect(epiWeek(new Date(Date.UTC(2025, 11, 28)))).toEqual({ year: 2026, week: 1 });
  });
  it('2021 e 2022 coincidem com MMWR (1º de janeiro em sexta e sábado)', () => {
    expect(epiWeekStart(2021, 1).toISOString().slice(0, 10)).toBe('2021-01-03');
    expect(epiWeekStart(2022, 1).toISOString().slice(0, 10)).toBe('2022-01-02');
    expect(epiWeek(new Date(Date.UTC(2021, 4, 14)))).toEqual({ year: 2021, week: 19 });
    expect(epiWeek(new Date(Date.UTC(2022, 7, 4)))).toEqual({ year: 2022, week: 31 });
    expect(epiWeek(new Date(Date.UTC(2022, 0, 3)))).toEqual({ year: 2022, week: 1 });
  });
  it('2026-04-29 é SE 18 e 2026-05-05 é SE 19 (linha real do SIVEP)', () => {
    expect(epiWeek(new Date(Date.UTC(2026, 3, 29)))).toEqual({ year: 2026, week: 18 });
    expect(epiWeek(new Date(Date.UTC(2026, 4, 5)))).toEqual({ year: 2026, week: 19 });
  });
  it('2025-10-06 é SE 41 de 2025 (linha real do SIVEP 2025)', () => {
    expect(epiWeek(new Date(Date.UTC(2025, 9, 6)))).toEqual({ year: 2025, week: 41 });
  });
  it('virada de ano: 2024-12-29 é SE 1 de 2025; 2023-01-01 é SE 1 de 2023', () => {
    expect(epiWeek(new Date(Date.UTC(2024, 11, 29)))).toEqual({ year: 2025, week: 1 });
    expect(epiWeek(new Date(Date.UTC(2023, 0, 1)))).toEqual({ year: 2023, week: 1 });
    expect(epiWeek(new Date(Date.UTC(2022, 11, 31)))).toEqual({ year: 2022, week: 52 });
  });
});

describe('periodBounds', () => {
  it('semana ISO', () => {
    expect(periodBounds('isoweek', weekPeriodId(2026, 41))).toEqual({ start: '2026-10-05', end: '2026-10-11' });
  });
  it('semana epidemiológica brasileira', () => {
    expect(periodBounds('epiweek', '2026-W41')).toEqual({ start: '2026-10-04', end: '2026-10-10' });
    expect(periodBounds('epiweek', '2026-W18')).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });
  it('mês e ano', () => {
    expect(periodBounds('month', '2026-M02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(periodBounds('year', '2024')).toEqual({ start: '2024-01-01', end: '2024-12-31' });
  });
});
