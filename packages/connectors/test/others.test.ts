import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BR_STATES } from '@h1n1/core';
import { normalizeIbge, checkEstados } from '../src/connectors/ibge.js';
import { normalizeWorldBank, aggregateCodes } from '../src/connectors/worldbank.js';
import { normalizeUkhsa, dataAsOfFromResults } from '../src/connectors/ukhsa.js';
import type { GeoEntry } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));

describe('ibge', () => {
  const env = load('ibge_envelope.json');
  it('as 27 UFs da API de localidades batem com BR_STATES', () => {
    expect(BR_STATES).toHaveLength(27);
    expect(checkEstados(env.estados)).toEqual({ ok: true, missing: [], unexpected: [] });
    expect(checkEstados(env.estados.slice(0, 26)).ok).toBe(false);
  });
  it('população por ano, BRA + BR-UF via código IBGE', () => {
    const obs = normalizeIbge(env.years, 's');
    expect(obs).toHaveLength(8);
    const bra = obs.find((o) => o.geo_code === 'BRA' && o.period === '2021')!;
    expect(bra.value).toBe(213317639);
    expect(bra.period_type).toBe('year');
    expect(bra.period_start).toBe('2021-01-01');
    expect(obs.find((o) => o.geo_code === 'BR-SP' && o.period === '2024')!.geo_level).toBe('state');
    expect(obs.find((o) => o.geo_code === 'BR-RO' && o.period === '2021')!.value).toBe(1815278);
  });
});

describe('worldbank', () => {
  const env = load('worldbank_envelope.json');
  it('ignora agregados, ISO3 vazio e value null', () => {
    const agg = aggregateCodes(env.countries);
    expect(agg.has('AFE')).toBe(true);
    const geo: GeoEntry[] = [];
    const obs = normalizeWorldBank(env.population, 's', agg, geo);
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ geo_code: 'BRA', geo_level: 'country', period: '2025', value: 212812405, period_type: 'year' });
    expect(geo).toEqual([{ code: 'BRA', level: 'country', name: 'Brazil', parent_code: 'WLD', iso2: 'BR' }]);
  });
});

describe('ukhsa', () => {
  const env = load('ukhsa_results.json');
  it('total = age all; estratos nas faixas da UKHSA (0-4 … 65-79, 80+); semana ISO; provisório em atraso', () => {
    const stats = { rows: 0, filtered: 0, null_values: 0, duplicates: 0, age_skipped: {} as Record<string, number> };
    const obs = normalizeUkhsa(env.results, 's', stats);
    // 2 totais (2017-W27 e 2026-W41) + 6 faixas de 2017-W27, todas previstas no stratum_schema da ontologia
    expect(obs).toHaveLength(8);
    expect(stats.age_skipped).toEqual({});
    const total = obs.find((o) => o.period === '2017-W27' && Object.keys(o.stratum).length === 0)!;
    expect(total.value).toBe(1.71);
    expect(total.geo_code).toBe('ENG');
    expect(total.update_status).toBe('final');
    expect(obs.find((o) => o.period === '2017-W27' && o.stratum.age === '0-4')!.value).toBe(0.35);
    expect(obs.find((o) => o.period === '2017-W27' && o.stratum.age === '5-14')!.value).toBe(0);
    expect(obs.find((o) => o.period === '2017-W27' && o.stratum.age === '15-44')!.value).toBe(3.59);
    expect(obs.find((o) => o.period === '2017-W27' && o.stratum.age === '65-79')).toBeTruthy();
    expect(obs.find((o) => o.period === '2017-W27' && o.stratum.age === '80+')).toBeTruthy();
    expect(new Set(obs.filter((o) => o.stratum.age).map((o) => o.stratum.age))).toEqual(new Set(['0-4', '5-14', '15-44', '45-64', '65-79', '80+']));
    const late = obs.find((o) => o.period === '2026-W41')!;
    expect(late.update_status).toBe('provisional');
    expect(dataAsOfFromResults(env.results)).toBe('2026-10-11');
  });
  it('faixa fora do stratum_schema continua descartada e contada', () => {
    const stats = { rows: 0, filtered: 0, null_values: 0, duplicates: 0, age_skipped: {} as Record<string, number> };
    const extra = { ...(env.results[1] as Record<string, unknown>), age: '90+' };
    const obs = normalizeUkhsa([...env.results, extra], 's', stats);
    expect(obs).toHaveLength(8);
    expect(stats.age_skipped).toEqual({ '90+': 1 });
  });
});
