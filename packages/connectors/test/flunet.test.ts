import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFluNetRows, dataAsOfFromRows, FluNetRow, flunetUrl } from '../src/connectors/flunet.js';
import type { GeoEntry } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const env = JSON.parse(readFileSync(join(here, 'fixtures', 'flunet_bra_3rows.json'), 'utf8')) as { value: unknown[] };

const find = (obs: ReturnType<typeof normalizeFluNetRows>, id: string, period: string, stratum: Record<string, string> = {}) =>
  obs.find((o) => o.indicator_id === id && o.period === period && JSON.stringify(o.stratum) === JSON.stringify(stratum));

describe('flunet normalize', () => {
  const geo: GeoEntry[] = [];
  const obs = normalizeFluNetRows(env.value, 'snap', geo);

  it('agrega total = soma das origens, ignorando nulos', () => {
    expect(find(obs, 'flunet_specimens_processed', '2026-W41')!.value).toBe(4218 + 92);
    expect(find(obs, 'flunet_ah1n1pdm09_detections', '2026-W41')!.value).toBe(4);
    // INF_A é null na linha SENTINEL: total = 4 (não soma como zero), e o estrato SENTINEL não é emitido
    expect(find(obs, 'flunet_inf_a_detections', '2026-W41')!.value).toBe(4);
    expect(find(obs, 'flunet_inf_a_detections', '2026-W41', { origin_source: 'SENTINEL' })).toBeUndefined();
    expect(find(obs, 'flunet_inf_a_detections', '2026-W41', { origin_source: 'NONSENTINEL' })!.value).toBe(4);
    expect(find(obs, 'flunet_inf_all_detections', '2026-W41')!.value).toBe(108);
  });

  it('semana com uma origem só: total igual ao estrato', () => {
    expect(find(obs, 'flunet_ah3_detections', '2026-W40')!.value).toBe(2);
    expect(find(obs, 'flunet_ah3_detections', '2026-W40', { origin_source: 'NONSENTINEL' })!.value).toBe(2);
    expect(find(obs, 'flunet_ah3_detections', '2026-W40', { origin_source: 'SENTINEL' })).toBeUndefined();
  });

  it('razões: positividade com denominador e share nula quando INF_A < 20', () => {
    const pos = find(obs, 'flunet_influenza_positivity', '2026-W41')!;
    expect(pos.denominator).toBe(4310);
    expect(pos.value).toBeCloseTo(100 * 108 / 4310, 3);
    const share = find(obs, 'flunet_ah1n1pdm09_share_of_inf_a', '2026-W41')!;
    expect(share.value).toBeNull();
    expect(share.denominator).toBe(4);
    expect(find(obs, 'flunet_ah1n1pdm09_share_of_inf_a', '2026-W41', { origin_source: 'SENTINEL' })).toBeUndefined();
    expect(find(obs, 'flunet_influenza_positivity', '2026-W41', { origin_source: 'SENTINEL' })!.value).toBeCloseTo(100 * 6 / 92, 3);
  });

  it('período ISO, geo país, status provisório nas 4 últimas semanas, geo garantido', () => {
    const o = find(obs, 'flunet_ah1n1pdm09_detections', '2026-W41')!;
    expect(o.period_type).toBe('isoweek');
    expect(o.period_start).toBe('2026-10-05');
    expect(o.period_end).toBe('2026-10-11');
    expect(o.geo_level).toBe('country');
    expect(o.geo_code).toBe('BRA');
    expect(o.update_status).toBe('provisional');
    expect(geo).toEqual([{ code: 'BRA', level: 'country', name: 'Brazil', parent_code: 'WLD', iso2: 'BR' }]);
    expect(dataAsOfFromRows(env.value.map((r) => FluNetRow.parse(r)))).toBe('2026-10-11');
  });

  it('sem supressão na normalização (valor 0 e valores pequenos preservados)', () => {
    expect(find(obs, 'flunet_ah3_detections', '2026-W41')!.value).toBe(0);
    expect(find(obs, 'flunet_ah1n1pdm09_detections', '2026-W40')!.value).toBe(2);
  });

  it('numerador > denominador na origem: valor nulo com flag, nunca > 100', () => {
    const rows = [{ ...(env.value[2] as Record<string, unknown>), SPEC_PROCESSED_NB: 25, INF_ALL: 30 }];
    const o = normalizeFluNetRows(rows, 's').find((x) => x.indicator_id === 'flunet_influenza_positivity' && Object.keys(x.stratum).length === 0)!;
    expect(o.value).toBeNull();
    expect(o.denominator).toBe(25);
    expect(o.quality_flags).toContain('numerator_exceeds_denominator');
  });

  it('URL OData com filtro por país', () => {
    expect(flunetUrl('BRA')).toContain("COUNTRY_CODE%20eq%20'BRA'");
  });
});
