import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BR_STATES, INDICATORS, stateGeoCode, type Observation } from '@h1n1/core';
import { aggregateSivepCsv, findSivepUrl, dataAsOfFromUrl, sivepConnector, SIVEP_INDICATORS, DELAY_CDF_ID, delayWindow } from '../src/connectors/sivep.js';
import { validateObservations } from '../src/validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'sivep_2026_30rows.csv');

let obs: Observation[];
let summary: Record<string, number>;
let tmp: string;
const get = (id: string, geo: string, period: string, stratum: Record<string, string> = {}) =>
  obs.find((o) => o.indicator_id === id && o.geo_code === geo && o.period === period && JSON.stringify(o.stratum) === JSON.stringify(stratum));

/** Cabeçalho real (194 colunas) do fixture + linhas sintéticas com só as colunas relevantes preenchidas. */
function writeCsv(name: string, rows: Array<Record<string, string>>): string {
  const header = readFileSync(fixture, 'utf8').split('\n')[0]!.replace(/^﻿/, '');
  const cols = header.split(';').map((c) => c.replace(/"/g, ''));
  const lines = rows.map((r) => cols.map((c) => `"${r[c] ?? ''}"`).join(';'));
  const path = join(tmp, name);
  writeFileSync(path, [header, ...lines].join('\n') + '\n');
  return path;
}
const base = { SG_UF: 'SP', CLASSI_FIN: '1', PCR_FLUASU: '1', TP_FLU_PCR: '1', EVOLUCAO: '1', UTI: '2', NU_IDADE_N: '30', TP_IDADE: '3' };

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'h1n1-sivep-'));
  const r = await aggregateSivepCsv(fixture, 2026, { dataAsOf: '2026-10-19' });
  obs = r.observations;
  summary = r.summary;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('sivep normalize (agregação em streaming)', () => {
  it('fixture tem BOM e datas dd/mm/aaaa, e ambos são lidos (cabeçalho reconhecido, nenhuma linha sem data)', async () => {
    const bytes = readFileSync(fixture);
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8');
    expect(text.split('\n').filter((l) => l.includes('05/03/2026'))).toHaveLength(5);
    expect(summary.rows_total).toBe(30);
    expect(summary.rows_no_date).toBe(0);
    // as 5 linhas dd/mm/aaaa (RJ, A(H3N2)) caem em 2026-W10
    expect(get('sivep_srag_ah3n2_confirmed', 'BR-RJ', '2026-W10')!.value).toBe(5);
  });

  it('contadores do arquivo', () => {
    expect(summary.rows_total).toBe(30);
    expect(summary.rows_outside_year).toBe(1);
    expect(summary.rows_uf_ignored).toBe(2);
    expect(summary.uf_ignored_weeks).toBe(1);
    expect(summary.rows_no_date).toBe(0);
    expect(summary.rows_sem_pri_mismatch).toBe(0);
    expect(summary.rows_age_unknown).toBe(1);
    expect(summary.max_week).toBe(12);
  });

  it('emite zeros explícitos para todas as células de SE1 até a última SE com dado', () => {
    // 12 semanas × (8 indicadores × 28 geos × (1 total + 7 faixas) + 1 completude) + atraso (28 geos × 13 d)
    expect(obs).toHaveLength(12 * (8 * 28 * 8 + 1) + 28 * 13);
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

  it('TP_IDADE nulo/inválido vai para a faixa NA (não 0-4); dias/meses vão para 0-4', async () => {
    const path = writeCsv('idade.csv', [
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10', NU_IDADE_N: '30', TP_IDADE: '' },
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10', NU_IDADE_N: '30', TP_IDADE: '9' },
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10', NU_IDADE_N: '', TP_IDADE: '3' },
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10', NU_IDADE_N: '15', TP_IDADE: '1' },
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10', NU_IDADE_N: '7', TP_IDADE: '2' },
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10', NU_IDADE_N: '3', TP_IDADE: '3' },
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10', NU_IDADE_N: '70', TP_IDADE: '3' },
    ]);
    const r = await aggregateSivepCsv(path, 2026);
    const find = (age: string) => r.observations.find((o) => o.indicator_id === 'sivep_srag_notifications' && o.geo_code === 'BRA' && o.period === '2026-W10' && o.stratum.age_group === age)!;
    expect(find('NA').value).toBe(3);
    expect(find('0-4').value).toBe(3);
    expect(find('65+').value).toBe(1);
    expect(r.summary.rows_age_unknown).toBe(3);
  });

  it('período = SEM_PRI quando válida; ano epidemiológico de DT_SIN_PRI; DT_SIN_PRI só como fallback da semana', async () => {
    const path = writeCsv('periodo.csv', [
      // SEM_PRI válida e coerente com a data
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '10' },
      // SEM_PRI válida mas divergente da data (W10): prevalece SEM_PRI=11; divergência contada
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '11' },
      // SEM_PRI inválida (0, 54, vazia): semana vem de DT_SIN_PRI (W10)
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '0' },
      { ...base, DT_SIN_PRI: '2026-03-02', SEM_PRI: '54' },
      { ...base, DT_SIN_PRI: '03/03/2026', SEM_PRI: '' },
      // sem data: ano do arquivo, semana de SEM_PRI
      { ...base, DT_SIN_PRI: '', SEM_PRI: '12' },
      // sem data nem SEM_PRI válida: descartada
      { ...base, DT_SIN_PRI: '', SEM_PRI: '' },
      // SEM_PRI=1 com data no fim de dezembro: ano epidemiológico 2026 (SE1/2026 começa em 28/12/2025)
      { ...base, DT_SIN_PRI: '2025-12-29', SEM_PRI: '1' },
      // ano epidemiológico 2025: fora do arquivo de 2026
      { ...base, DT_SIN_PRI: '2025-12-20', SEM_PRI: '51' },
    ]);
    const r = await aggregateSivepCsv(path, 2026);
    const nat = (p: string) => r.observations.find((o) => o.indicator_id === 'sivep_srag_notifications' && o.geo_code === 'BRA' && o.period === p && !Object.keys(o.stratum).length)!.value;
    expect(nat('2026-W10')).toBe(4);
    expect(nat('2026-W11')).toBe(1);
    expect(nat('2026-W12')).toBe(1);
    expect(nat('2026-W01')).toBe(1);
    expect(r.summary).toMatchObject({ rows_total: 9, rows_used: 7, rows_sem_pri_mismatch: 1, rows_week_from_date: 3, rows_no_date: 1, rows_outside_year: 1, max_week: 12 });
  });

  it('completude de subtipagem: só nacional, nula quando denominador < 20', () => {
    const c = get('sivep_srag_influenza_subtype_completeness', 'BRA', '2026-W10')!;
    expect(c.value).toBeNull();
    expect(c.denominator).toBe(15);
    expect(get('sivep_srag_influenza_subtype_completeness', 'BRA', '2026-W12')!.denominator).toBe(5);
    expect(obs.filter((o) => o.indicator_id === 'sivep_srag_influenza_subtype_completeness' && o.geo_code !== 'BRA')).toHaveLength(0);
  });

  it('período epi e status provisório nas 8 últimas semanas', () => {
    const o = get('sivep_srag_notifications', 'BRA', '2026-W01')!;
    expect(o.period_type).toBe('epiweek');
    expect(o.period_start).toBe('2025-12-28');
    expect(o.period_end).toBe('2026-01-03');
    expect(o.update_status).toBe('final');
    expect(get('sivep_srag_notifications', 'BRA', '2026-W04')!.update_status).toBe('final');
    expect(get('sivep_srag_notifications', 'BRA', '2026-W05')!.update_status).toBe('provisional');
  });

  it('flag uf_ignored só nas semanas com linhas sem UF válida, no total nacional e nos estratos', () => {
    // as 2 linhas sem UF válida ('' e 'XX') são de 2026-W12
    expect(get('sivep_srag_notifications', 'BRA', '2026-W12')!.quality_flags).toContain('uf_ignored');
    expect(get('sivep_srag_notifications', 'BRA', '2026-W12', { age_group: '30-49' })!.quality_flags).toContain('uf_ignored');
    expect(get('sivep_srag_ah1n1pdm09_confirmed', 'BRA', '2026-W12', { age_group: 'NA' })!.quality_flags).toContain('uf_ignored');
    expect(get('sivep_srag_notifications', 'BRA', '2026-W01')!.quality_flags).not.toContain('uf_ignored');
    expect(get('sivep_srag_notifications', 'BRA', '2026-W10')!.quality_flags).not.toContain('uf_ignored');
    expect(get('sivep_srag_notifications', 'BR-SP', '2026-W12')!.quality_flags).not.toContain('uf_ignored');
    expect(get('sivep_srag_notifications', 'BR-SP', '2026-W12', { age_group: 'NA' })!.quality_flags).not.toContain('uf_ignored');
  });

  it('produz exatamente os indicadores sivep_* da ontologia do core', () => {
    const coreIds = INDICATORS.filter((i) => i.id.startsWith('sivep_')).map((i) => i.id).sort();
    expect(coreIds.length).toBeGreaterThan(0);
    expect([...sivepConnector.indicators].sort()).toEqual(coreIds);
    expect([...SIVEP_INDICATORS].sort()).toEqual(coreIds);
    expect([...new Set(obs.map((x) => x.indicator_id))].sort()).toEqual(coreIds);
  });

  it('saída do fixture passa na validação com invariantes cruzadas', () => {
    const geo = new Set(['BRA', ...BR_STATES.map((s) => stateGeoCode(s.uf))]);
    const r = validateObservations(obs, { validGeoCodes: geo, previousCounts: new Map() }, SIVEP_INDICATORS);
    expect(r.errors).toEqual([]);
    expect(r.cross_checks).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('não retém o CSV bruto (microdados): retainRaw = false', () => {
    expect(sivepConnector.retainRaw).toBe(false);
  });

  it('respeita --max-rows', async () => {
    const r = await aggregateSivepCsv(fixture, 2026, { maxRows: 10 });
    expect(r.summary.rows_total).toBe(10);
  });

  it('descobre a URL do CSV no HTML e a data no nome do arquivo', () => {
    const html = `<a href="https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2025/INFLUD25-19-10-2026.csv">x</a>
      <a href="https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-19-10-2026.csv">y</a>`;
    expect(findSivepUrl(html, 2026)).toBe('https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-19-10-2026.csv');
    expect(findSivepUrl(html, 2024)).toBeNull();
    expect(dataAsOfFromUrl('https://x/SRAG/2026/INFLUD26-19-10-2026.csv')).toBe('2026-10-19');
  });

  it('sivep_reporting_delay_cdf no fixture de 30 linhas: 28 geos × 13 d, valores nulos (n < 100), denominador = n', () => {
    const delay = obs.filter((o) => o.indicator_id === DELAY_CDF_ID);
    expect(delay).toHaveLength(28 * 13);
    expect(delay.every((o) => o.period_type === 'year' && o.period === '2026' && o.value === null)).toBe(true);
    // 21 linhas CLASSI_FIN=1 do fixture (2026-W10/W12) caem na janela 2025-07-21..2026-07-19
    expect(get(DELAY_CDF_ID, 'BRA', '2026', { delay_weeks: '0' })!.denominator).toBe(21);
    expect(get(DELAY_CDF_ID, 'BR-AC', '2026', { delay_weeks: '12' })!.denominator).toBe(0);
  });
});

describe('sivep_reporting_delay_cdf (fixture sintética)', () => {
  const onset = '2026-03-01'; // SE 10/2026 (domingo)
  const plus = (days: number) => { const d = new Date(Date.UTC(2026, 2, 1) + days * 86_400_000); return d.toISOString().slice(0, 10); };
  const row = (o: Record<string, string>) => ({ ...base, DT_SIN_PRI: onset, SEM_PRI: '10', DT_NOTIFIC: plus(2), DT_DIGITA: plus(3), ...o });
  let r: Awaited<ReturnType<typeof aggregateSivepCsv>>;
  const cdf = (geo: string, d: number) => r.observations.find((o) => o.indicator_id === DELAY_CDF_ID && o.geo_code === geo && o.stratum.delay_weeks === String(d))!;

  beforeAll(async () => {
    const rows: Array<Record<string, string>> = [
      ...Array.from({ length: 60 }, () => row({ DT_DIGITA: plus(3) })),              // SP, 0 semanas
      ...Array.from({ length: 30 }, () => row({ DT_DIGITA: plus(8) })),              // SP, 1 semana
      ...Array.from({ length: 20 }, () => row({ DT_DIGITA: plus(14) })),             // SP, 2 semanas
      ...Array.from({ length: 10 }, () => row({ DT_DIGITA: plus(100) })),            // SP, > 12 semanas (só no n)
      row({ DT_DIGITA: plus(-5) }),                                                   // SP, negativo → 0
      row({ DT_DIGITA: '', DT_NOTIFIC: plus(8) }),                                    // SP, sem DT_DIGITA → DT_NOTIFIC (1 semana)
      row({ DT_DIGITA: '', DT_NOTIFIC: '' }),                                         // SP, sem data de digitação: ignorada (contada)
      ...Array.from({ length: 5 }, () => row({ SG_UF: 'RJ', DT_DIGITA: plus(3) })),  // RJ, n = 5 < 100 → nulo
      ...Array.from({ length: 2 }, () => row({ SG_UF: '', DT_DIGITA: plus(3) })),    // sem UF: só no nacional
      row({ CLASSI_FIN: '4' }),                                                       // não influenza: fora do universo
      row({ DT_SIN_PRI: '2026-08-02', SEM_PRI: '32', DT_DIGITA: '2026-08-05' }),      // 13 semanas recentes: fora da janela
      row({ DT_SIN_PRI: '2025-10-05', SEM_PRI: '40', DT_DIGITA: '2025-10-08' }),      // na janela, mas ano epidemiológico 2025: fora do arquivo 2026
    ];
    const path = writeCsv('delay.csv', rows);
    r = await aggregateSivepCsv(path, 2026, { dataAsOf: '2026-10-19' });
  });

  it('janela: primeiros sintomas entre 65 e 13 semanas antes de data_as_of; período = ano epidemiológico de data_as_of', () => {
    expect(delayWindow('2026-10-19')).toEqual({ data_as_of: '2026-10-19', period: '2026', from: '2025-07-21', to: '2026-07-19' });
    expect(delayWindow('2026-01-04').period).toBe('2026');
    expect(delayWindow('2025-12-27').period).toBe('2025');
  });

  it('CDF por geo: value = 100 × (atraso ≤ d) / n, denominator = n; negativos → 0; DT_NOTIFIC como fallback; ausentes ignorados', () => {
    // SP: n = 60 + 30 + 20 + 10 + 1 (negativo) + 1 (DT_NOTIFIC) = 122
    expect(cdf('BR-SP', 0).denominator).toBe(122);
    expect(cdf('BR-SP', 0).value).toBeCloseTo(100 * 61 / 122, 3);
    expect(cdf('BR-SP', 1).value).toBeCloseTo(100 * 92 / 122, 3);
    expect(cdf('BR-SP', 2).value).toBeCloseTo(100 * 112 / 122, 3);
    expect(cdf('BR-SP', 12).value).toBeCloseTo(100 * 112 / 122, 3);
    // BRA: SP 122 + RJ 5 + sem UF 2 = 129
    expect(cdf('BRA', 0).denominator).toBe(129);
    expect(cdf('BRA', 0).value).toBeCloseTo(100 * 68 / 129, 3);
    expect(cdf('BRA', 1).value).toBeCloseTo(100 * 99 / 129, 3);
    expect(cdf('BRA', 12).value).toBeCloseTo(100 * 119 / 129, 3);
    expect(cdf('BRA', 0).quality_flags).toContain('uf_ignored');
    expect(cdf('BR-SP', 0).quality_flags).not.toContain('uf_ignored');
    // RJ: n = 5 < 100 → valor nulo, denominador preservado; UF sem registros: n = 0
    expect(cdf('BR-RJ', 3)).toMatchObject({ value: null, denominator: 5 });
    expect(cdf('BR-AM', 3)).toMatchObject({ value: null, denominator: 0 });
    for (const geo of ['BRA', 'BR-SP']) {
      const vals = Array.from({ length: 13 }, (_, d) => cdf(geo, d).value!);
      expect(vals.every((v, i) => i === 0 || v >= vals[i - 1]!)).toBe(true);
      expect(vals.every((v) => v >= 0 && v <= 100)).toBe(true);
    }
    const o = cdf('BRA', 0);
    expect(o).toMatchObject({ period_type: 'year', period: '2026', period_start: '2026-01-01', period_end: '2026-12-31', geo_level: 'country', update_status: 'provisional' });
    expect(cdf('BR-SP', 0).geo_level).toBe('state');
    expect(r.observations.filter((o) => o.indicator_id === DELAY_CDF_ID)).toHaveLength(28 * 13);
  });

  it('delay_window_coverage: janela cruzando anos restrita ao ano epidemiológico do arquivo; contadores', () => {
    expect(r.delay_window_coverage).toMatchObject({
      data_as_of: '2026-10-19', period: '2026', window_from: '2025-07-21', window_to: '2026-07-19', window_weeks: 52, excluded_recent_weeks: 13,
      file_year: 2026, file_year_from: '2025-12-28', effective_from: '2025-12-28', effective_to: '2026-07-19', effective_weeks: 29.1,
      observed_onset_min: '2026-03-01', observed_onset_max: '2026-03-01',
      rows_in_window: 130, rows_missing_digita: 1, rows_negative_delay: 1, rows_uf_ignored: 2, n_bra: 129, ufs_below_min_denominator: 26, min_denominator: 100,
    });
    // a linha de 2025 está na janela mas fora do arquivo (ano epidemiológico 2025); a de agosto está nas 13 semanas excluídas
    expect(r.summary.rows_outside_year).toBe(1);
  });

  it('sem data_as_of o indicador não é emitido e a cobertura é nula', async () => {
    const r2 = await aggregateSivepCsv(fixture, 2026);
    expect(r2.delay_window_coverage).toBeNull();
    expect(r2.observations.some((o) => o.indicator_id === DELAY_CDF_ID)).toBe(false);
  });

  it('saída sintética passa na validação (monotonia e 0..100)', () => {
    const geo = new Set(['BRA', ...BR_STATES.map((s) => stateGeoCode(s.uf))]);
    const v = validateObservations(r.observations, { validGeoCodes: geo, previousCounts: new Map() }, SIVEP_INDICATORS);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });
});
