import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Observation } from '@h1n1/core';
import { aggregateSivepCsv, findSivepUrl, dataAsOfFromUrl, SIVEP_INDICATORS } from '../src/connectors/sivep.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'sivep_2026_30rows.csv');

let obs: Observation[];
let summary: Record<string, number>;
const get = (id: string, geo: string, period: string, stratum: Record<string, string> = {}) =>
  obs.find((o) => o.indicator_id === id && o.geo_code === geo && o.period === period && JSON.stringify(o.stratum) === JSON.stringify(stratum));

beforeAll(async () => {
  const r = await aggregateSivepCsv(fixture, 2026);
  obs = r.observations;
  summary = r.summary;
});

describe('sivep normalize (agregação em streaming)', () => {
  it('contadores do arquivo', () => {
    expect(summary.rows_total).toBe(30);
    expect(summary.rows_outside_year).toBe(1);
    expect(summary.rows_uf_ignored).toBe(2);
    expect(summary.rows_no_date).toBe(0);
    expect(summary.max_week).toBe(12);
  });

  it('emite zeros explícitos para todas as células de SE1 até a última SE com dado', () => {
    // 12 semanas × (8 indicadores × 28 geos × (1 total + 7 faixas) + 1 completude)
    expect(obs).toHaveLength(12 * (8 * 28 * 8 + 1));
    expect(get('sivep_srag_notifications', 'BR-AC', '2026-W03')!.value).toBe(0);
    expect(get('sivep_srag_ah1n1pdm09_confirmed', 'BRA', '2026-W01', { age_group: '65+' })!.value).toBe(0);
  });

  it('SRAG total vs influenza vs H1N1 confirmado (CLASSI_FIN / PCR_FLUASU)', () => {
    expect(get('sivep_srag_notifications', 'BRA', '2026-W10')!.value).toBe(15);
    expect(get('sivep_srag_notifications', 'BRA', '2026-W12')!.value).toBe(14);
    expect(get('sivep_srag_notifications', 'BR-SP', '2026-W12')!.value).toBe(11);
    expect(get('sivep_srag_influenza_confirmed', 'BRA', '2026-W10')!.value).toBe(15);
    expect(get('sivep_srag_influenza_confirmed', 'BRA', '2026-W12')!.value).toBe(6);
    expect(get('sivep_srag_ah1n1pdm09_confirmed', 'BRA', '2026-W10')!.value).toBe(10);
    expect(get('sivep_srag_ah1n1pdm09_confirmed', 'BR-SP', '2026-W10')!.value).toBe(10);
    // PCR_FLUASU=1 com CLASSI_FIN=4 não conta como H1N1; linhas sem UF só entram no nacional
    expect(get('sivep_srag_ah1n1pdm09_confirmed', 'BRA', '2026-W12')!.value).toBe(2);
    expect(get('sivep_srag_ah1n1pdm09_confirmed', 'BR-SP', '2026-W12')!.value).toBe(0);
    expect(get('sivep_srag_ah3n2_confirmed', 'BR-RJ', '2026-W10')!.value).toBe(5);
    expect(get('sivep_srag_inf_a_not_subtyped', 'BR-SP', '2026-W12')!.value).toBe(3);
    expect(get('sivep_srag_inf_a_not_subtyped', 'BRA', '2026-W10')!.value).toBe(0);
  });

  it('óbitos e UTI só entre influenza confirmada', () => {
    expect(get('sivep_srag_influenza_deaths', 'BRA', '2026-W10')!.value).toBe(2);
    expect(get('sivep_srag_influenza_deaths', 'BRA', '2026-W12')!.value).toBe(1);
    expect(get('sivep_srag_ah1n1pdm09_deaths', 'BRA', '2026-W10')!.value).toBe(2);
    expect(get('sivep_srag_ah1n1pdm09_deaths', 'BRA', '2026-W12')!.value).toBe(0);
    expect(get('sivep_srag_influenza_icu', 'BRA', '2026-W10')!.value).toBe(3);
    expect(get('sivep_srag_influenza_icu', 'BRA', '2026-W12')!.value).toBe(3);
  });

  it('faixas etárias (TP_IDADE) e soma dos estratos = total', () => {
    expect(get('sivep_srag_ah3n2_confirmed', 'BR-RJ', '2026-W10', { age_group: '65+' })!.value).toBe(5);
    expect(get('sivep_srag_inf_a_not_subtyped', 'BR-SP', '2026-W12', { age_group: '0-4' })!.value).toBe(3);
    expect(get('sivep_srag_notifications', 'BR-SP', '2026-W12', { age_group: 'NA' })!.value).toBe(1);
    const strata = obs.filter((o) => o.indicator_id === 'sivep_srag_notifications' && o.geo_code === 'BR-SP' && o.period === '2026-W12' && Object.keys(o.stratum).length);
    expect(strata).toHaveLength(7);
    expect(strata.reduce((s, o) => s + (o.value ?? 0), 0)).toBe(11);
  });

  it('completude de subtipagem: só nacional, nula quando denominador < 20', () => {
    const c = get('sivep_srag_influenza_subtype_completeness', 'BRA', '2026-W10')!;
    expect(c.value).toBeNull();
    expect(c.denominator).toBe(15);
    expect(get('sivep_srag_influenza_subtype_completeness', 'BRA', '2026-W12')!.denominator).toBe(5);
    expect(obs.filter((o) => o.indicator_id === 'sivep_srag_influenza_subtype_completeness' && o.geo_code !== 'BRA')).toHaveLength(0);
  });

  it('período epi, status provisório nas 8 últimas semanas, flag uf_ignored no total nacional', () => {
    const o = get('sivep_srag_notifications', 'BRA', '2026-W01')!;
    expect(o.period_type).toBe('epiweek');
    expect(o.period_start).toBe('2025-12-28');
    expect(o.period_end).toBe('2026-01-03');
    expect(o.update_status).toBe('final');
    expect(get('sivep_srag_notifications', 'BRA', '2026-W04')!.update_status).toBe('final');
    expect(get('sivep_srag_notifications', 'BRA', '2026-W05')!.update_status).toBe('provisional');
    expect(o.quality_flags).toContain('uf_ignored');
    expect(get('sivep_srag_notifications', 'BR-SP', '2026-W01')!.quality_flags).not.toContain('uf_ignored');
    expect(new Set(obs.map((x) => x.indicator_id))).toEqual(new Set(SIVEP_INDICATORS));
  });

  it('respeita --max-rows', async () => {
    const r = await aggregateSivepCsv(fixture, 2026, 10);
    expect(r.summary.rows_total).toBe(10);
  });

  it('descobre a URL do CSV no HTML e a data no nome do arquivo', () => {
    const html = `<a href="https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2025/INFLUD25-19-10-2026.csv">x</a>
      <a href="https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-19-10-2026.csv">y</a>`;
    expect(findSivepUrl(html, 2026)).toBe('https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-19-10-2026.csv');
    expect(findSivepUrl(html, 2024)).toBeNull();
    expect(dataAsOfFromUrl('https://x/SRAG/2026/INFLUD26-19-10-2026.csv')).toBe('2026-10-19');
  });
});
