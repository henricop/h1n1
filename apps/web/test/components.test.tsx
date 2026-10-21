import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ApiResult, FreshnessState, SeriesObservation, SeriesResult } from '@/lib/api';
import { IndicatorCard } from '@/components/IndicatorCard';
import { DataUnavailable, FreshnessNote, NoDataPublished } from '@/components/Notices';
import { CommandPaletteButton } from '@/components/sala/CommandPaletteButton';
import { LineChart } from '@/components/charts/LineChart';
import { SeriesTable } from '@/components/charts/SeriesTable';
import { Sparkline } from '@/components/charts/Sparkline';

function obs(period: string, value: number | null, suppressed = false, update_status: 'provisional' | 'final' = 'final'): SeriesObservation {
  return { geo_level: 'country', geo_code: 'BRA', period, period_start: '2026-01-01', period_end: '2026-01-07', value, denominator: null, stratum: {}, suppressed, update_status, quality_flags: [] };
}

const VERIFIED_OK: FreshnessState = { verified: true, row: null, stale: false };
const UNVERIFIED: FreshnessState = { verified: false, row: null, stale: false, error: 'Falha ao acessar /v1/freshness' };

function fakeSeries(observations: SeriesObservation[]): ApiResult<SeriesResult> {
  return {
    ok: true,
    fetchedAt: '2026-10-20T00:00:00Z',
    data: {
      indicator: {
        id: 'sivep_srag_ah1n1pdm09_confirmed',
        name: 'SRAG por A(H1N1)pdm09 (teste)',
        description: 'd',
        source_id: 'BR-03',
        case_definition: 'c',
        measurement: 'count',
        unit: 'notifications',
        universe_note: 'Universo de teste.',
        methodology_version: 'v1',
        geo_levels: ['country'],
        period_type: 'epiweek',
        event_date_basis: 'symptom_onset',
        stratum_schema: {},
        mirror_group: null,
        suppression_threshold: 5,
        denominator_indicator_id: null,
        min_denominator: null,
        caveats: [],
      },
      source: { id: 'BR-03', slug: 'br_sivep_gripe', name: 'S', agency: 'A', country: 'BR', region: 'Brasil', category: 'c', access: 'a', access_type: 'open_data', h1n1_scope: 'h', update_cadence: 'u', priority: 'P0', url: 'https://x', notes: 'n', license: 'CC-BY', mirror_group: null, api_tested_at: null },
      publication: null,
      snapshot: null,
      observations,
      meta: { data_as_of: '2026-10-13', fetched_at: null, universe_note: 'Universo de teste.', case_definition: 'c', license: 'CC-BY', suppression_threshold: 5, caveats: [], count: observations.length },
    },
  };
}

describe('FreshnessNote', () => {
  it('mostra "frescor não verificado" quando /v1/freshness falhou e nada quando verificado e atual', () => {
    expect(renderToStaticMarkup(<FreshnessNote state={UNVERIFIED} />)).toContain('frescor não verificado');
    expect(renderToStaticMarkup(<FreshnessNote state={VERIFIED_OK} />)).toBe('');
    const stale = renderToStaticMarkup(<FreshnessNote state={{ verified: true, stale: true, row: { indicator_id: 'x', source_id: 's', snapshot_id: null, data_as_of: null, fetched_at: null, published_at: null, age_days: 20, last_run_status: 'ok', last_run_finished_at: null } }} />);
    expect(stale).toContain('Dado defasado');
    expect(stale).toContain('20 dias');
  });
});

describe('avisos de dado (achado i) e botão da paleta (achado l)', () => {
  it('DataUnavailable usa o attemptedAt real; NoDataPublished distingue ausência de falha', () => {
    const html = renderToStaticMarkup(<DataUnavailable attemptedAt="2026-10-20T10:05:00Z" />);
    expect(html).toContain('10:05 UTC de 20/10/2026');
    const empty = renderToStaticMarkup(<NoDataPublished what="as últimas 52 semanas" />);
    expect(empty).toContain('Sem dado publicado');
    expect(empty).toContain('Ausência de dado não é zero');
    expect(empty).not.toContain('Dados indisponíveis');
  });

  it('CommandPaletteButton é uma pílula "Buscar ⌘K" sem classes do HUD', () => {
    const html = renderToStaticMarkup(<CommandPaletteButton />);
    expect(html).toContain('Buscar');
    expect(html).toContain('⌘K');
    expect(html).toMatch(/class="btn/);
    expect(html).not.toMatch(/hud-|scanlines|glow-/);
  });
});

describe('IndicatorCard', () => {
  it('estado de falha mostra o nome legível do indicador, não o id bruto', () => {
    const failed: ApiResult<SeriesResult> = { ok: false, status: 'unavailable', error: 'x', attemptedAt: '2026-10-20T10:00:00Z' };
    const html = renderToStaticMarkup(<IndicatorCard id="sivep_srag_ah1n1pdm09_confirmed" series={failed} freshness={UNVERIFIED} weeks={8} geoLabel="Brasil" />);
    expect(html).toContain('SRAG por A(H1N1)pdm09 confirmada por RT-PCR');
    expect(html).not.toMatch(/<h3[^>]*>sivep_srag_ah1n1pdm09_confirmed</);
    expect(html).toContain('Dados indisponíveis no momento');
  });

  it('exibe a nota de frescor ao lado do valor quando /v1/freshness falhou e nunca o valor de célula suprimida', () => {
    const series = fakeSeries([obs('2026-W40', 100), obs('2026-W41', 120), obs('2026-W42', 4242, true)]);
    const html = renderToStaticMarkup(<IndicatorCard id="sivep_srag_ah1n1pdm09_confirmed" series={series} freshness={UNVERIFIED} weeks={8} geoLabel="Brasil" />);
    expect(html).toContain('frescor não verificado');
    expect(html).not.toContain('4242');
    expect(html).not.toContain('4.242');
    expect(html).toContain('120');
    expect(html).toContain('SE 41/2026');
    const ok = renderToStaticMarkup(<IndicatorCard id="sivep_srag_ah1n1pdm09_confirmed" series={series} freshness={VERIFIED_OK} weeks={8} geoLabel="Brasil" />);
    expect(ok).not.toContain('frescor não verificado');
    expect(ok).not.toContain('Dado defasado');
  });
});

describe('gráficos e tabela ignoram células suprimidas', () => {
  const series = [obs('2026-W40', 100), obs('2026-W41', 120), obs('2026-W42', 9999, true), obs('2026-W43', 130, false, 'provisional')];

  it('Sparkline não desenha o ponto suprimido (lacuna entre segmentos)', () => {
    const html = renderToStaticMarkup(<Sparkline obs={series} label="t" />);
    const polylines = html.match(/<polyline/g) ?? [];
    // W40–W41 formam um segmento; a célula suprimida abre lacuna e W43 fica isolada (sem segmento de 1 ponto)
    expect(polylines.length).toBe(1);
    const pts = /points="([^"]+)"/.exec(html)![1]!.split(' ');
    expect(pts.length).toBe(2);
  });

  it('LineChart marca lacuna e não plota o valor suprimido', () => {
    const html = renderToStaticMarkup(<LineChart obs={series} title="t" unit="notifications" tableId="tab" />);
    expect(html).toContain('Lacunas: valores suprimidos ou não publicados');
    const circles = html.match(/<circle/g) ?? [];
    expect(circles.length).toBe(3);
    // o eixo Y não é esticado pelo valor suprimido (9999)
    expect(html).not.toContain('10.000');
  });

  it('SeriesTable mostra "<5" na célula suprimida', () => {
    const html = renderToStaticMarkup(<SeriesTable id="t" caption="c" obs={series} unit="notifications" suppressionThreshold={5} />);
    expect(html).toContain('&lt;5');
    expect(html).not.toContain('9.999');
  });
});
