import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FreshnessRow, SeriesObservation } from '@/lib/api';
import { STALE_AFTER_DAYS, freshnessState, isStale } from '@/lib/api';
import { slugify } from '@/lib/format';
import { OBSERVATORY_INDICATORS, indicatorLabel, resolveObservatoryQuery } from '@/lib/observatory';
import { allSuppressed, lastPublished, publishedValue, sliceInterval } from '@/lib/series';

function obs(period: string, value: number | null, suppressed = false): SeriesObservation {
  return {
    geo_level: 'country',
    geo_code: 'BRA',
    period,
    period_start: '2026-01-01',
    period_end: '2026-01-07',
    value,
    denominator: null,
    stratum: {},
    suppressed,
    update_status: 'final',
    quality_flags: [],
  };
}

function freshRow(age_days: number | null): FreshnessRow {
  return { indicator_id: 'x', source_id: 'BR-03', snapshot_id: null, data_as_of: null, fetched_at: null, published_at: null, age_days, last_run_status: 'ok', last_run_finished_at: null };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('células suprimidas', () => {
  it('publishedValue nunca devolve o valor de uma célula suppressed', () => {
    expect(publishedValue(obs('2026-W01', 7, true))).toBeNull();
    expect(publishedValue(obs('2026-W01', 7))).toBe(7);
    expect(publishedValue(obs('2026-W01', null))).toBeNull();
  });

  it('lastPublished ignora célula suprimida mesmo que traga valor', () => {
    const series = [obs('2026-W01', 10), obs('2026-W02', 12), obs('2026-W03', 3, true)];
    expect(lastPublished(series)?.period).toBe('2026-W02');
    expect(lastPublished([obs('2026-W01', 4, true)])).toBeNull();
    expect(lastPublished([])).toBeNull();
  });

  it('allSuppressed só é verdadeiro quando toda célula está suprimida', () => {
    expect(allSuppressed([obs('2026-W01', null, true), obs('2026-W02', null, true)])).toBe(true);
    expect(allSuppressed([obs('2026-W01', null, true), obs('2026-W02', 9)])).toBe(false);
    expect(allSuppressed([])).toBe(false);
  });

  it('sliceInterval respeita o intervalo', () => {
    const series = Array.from({ length: 30 }, (_, i) => obs(`2026-W${String(i + 1).padStart(2, '0')}`, i));
    expect(sliceInterval(series, 'ultimas-12-semanas').length).toBe(12);
    expect(sliceInterval(series, 'ultimas-8-semanas').length).toBe(8);
    expect(sliceInterval(series, 'ano').length).toBe(30);
  });
});

describe('isStale nos limites', () => {
  it('14 dias não é defasado; 15 dias é', () => {
    expect(STALE_AFTER_DAYS).toBe(14);
    expect(isStale(freshRow(13))).toBe(false);
    expect(isStale(freshRow(14))).toBe(false);
    expect(isStale(freshRow(15))).toBe(true);
    expect(isStale(freshRow(null))).toBe(false);
    expect(isStale(null)).toBe(false);
  });

  it('freshnessState marca "não verificado" quando /v1/freshness falhou', () => {
    const failed = { ok: false as const, status: 'unavailable' as const, error: 'x', attemptedAt: '2026-10-20T00:00:00Z' };
    expect(freshnessState(failed, 'x')).toMatchObject({ verified: false, stale: false, row: null, error: 'x' });
    const okFresh = { ok: true as const, data: { data: [freshRow(15)] }, fetchedAt: '2026-10-20T00:00:00Z' };
    expect(freshnessState(okFresh, 'x')).toMatchObject({ verified: true, stale: true });
    expect(freshnessState(okFresh, 'nao-consta')).toMatchObject({ verified: true, stale: false, row: null });
  });
});

describe('observatório', () => {
  it('indicatorLabel devolve nome legível do observatório, do core ou o id', () => {
    expect(indicatorLabel('sivep_srag_ah1n1pdm09_confirmed')).toBe('SRAG por A(H1N1)pdm09 confirmada por RT-PCR');
    expect(indicatorLabel('sivep_srag_influenza_subtype_completeness')).not.toBe('sivep_srag_influenza_subtype_completeness');
    expect(indicatorLabel('sivep_srag_influenza_subtype_completeness')).toMatch(/subtip/i);
    expect(indicatorLabel('nao_existe')).toBe('nao_existe');
  });

  it('searchParams inválidos caem no padrão sem lançar', () => {
    const q = resolveObservatoryQuery({ indicador: 'nao-existe', uf: 'ZZ', intervalo: 'qualquer' });
    expect(q.indicador.id).toBe(OBSERVATORY_INDICATORS[0]!.id);
    expect(q.state).toBeNull();
    expect(q.ufIgnored).toBe(false);
    expect(q.intervalo).toBe('ultimas-12-semanas');
    // 'ultimas-8-semanas' é só da homepage: não é opção do observatório
    expect(resolveObservatoryQuery({ intervalo: 'ultimas-8-semanas' }).intervalo).toBe('ultimas-12-semanas');
    // arrays repetidos usam o primeiro valor; vazio é padrão
    expect(resolveObservatoryQuery({ indicador: ['flunet_ah1n1pdm09_detections', 'x'], intervalo: ['ultimas-26-semanas'] })).toMatchObject({
      indicador: { id: 'flunet_ah1n1pdm09_detections' },
      intervalo: 'ultimas-26-semanas',
    });
    expect(resolveObservatoryQuery({}).indicador.id).toBe(OBSERVATORY_INDICATORS[0]!.id);
  });

  it('UF válida é aceita (minúsculas inclusive) e ignorada com aviso para FluNet', () => {
    expect(resolveObservatoryQuery({ indicador: 'sivep_srag_ah1n1pdm09_confirmed', uf: 'sp' }).state?.uf).toBe('SP');
    const fl = resolveObservatoryQuery({ indicador: 'flunet_ah1n1pdm09_detections', uf: 'SP' });
    expect(fl.state).toBeNull();
    expect(fl.ufIgnored).toBe(true);
  });
});

describe('slugify (ids de seção)', () => {
  it('remove acentos, espaços e símbolos', () => {
    expect(slugify('América Latina')).toBe('america-latina');
    expect(slugify('União Europeia')).toBe('uniao-europeia');
    expect(slugify('Estados Unidos')).toBe('estados-unidos');
    expect(slugify('  Reino Unido / Irlanda ')).toBe('reino-unido-irlanda');
    expect(slugify('')).toBe('secao');
    expect(slugify('América Latina')).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('site URL por ambiente', () => {
  it('dev/test sem NEXT_PUBLIC_SITE_URL usa localhost', async () => {
    const { resolveSiteUrl } = await import('@/lib/site');
    expect(resolveSiteUrl({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('http://localhost:3000');
    expect(resolveSiteUrl({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe('http://localhost:3000');
    expect(resolveSiteUrl({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://exemplo.test/' } as NodeJS.ProcessEnv)).toBe('https://exemplo.test');
  });

  it('produção sem NEXT_PUBLIC_SITE_URL lança erro claro; durante o build só avisa', async () => {
    const { resolveSiteUrl } = await import('@/lib/site');
    expect(() => resolveSiteUrl({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/defina NEXT_PUBLIC_SITE_URL/);
    expect(() => resolveSiteUrl({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/domínio final a definir/);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveSiteUrl({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' } as NodeJS.ProcessEnv)).toBe('http://localhost:3000');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('o módulo lança na importação em produção sem a variável', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEXT_PHASE', '');
    await expect(import('@/lib/site')).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
