/**
 * Ferramentas tipadas (zod) do assistente. Executam no servidor via src/lib/api.ts e devolvem payloads
 * compactos com fonte, data da base, texto de universo e citações. Nenhum número chega ao modelo sem metadados.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { INDICATORS } from '@h1n1/core';
import { getFreshness, getIndicators, getSeries, getSources, type ApiResult, type SeriesObservation, type SeriesParams, type SeriesResult } from '@/lib/api';
import { getGlossaryTerm, GLOSSARY } from '@/lib/glossary';
import { getEars, getNowcast } from '@/lib/terminal/analytics';
import { searchPages } from './search';

export const MAX_SERIES_POINTS = 26;

export const IndicatorIdSchema = z.string().regex(/^[a-z0-9_]+$/, 'id em snake_case').max(80).describe('Id do indicador, ex.: sivep_srag_ah1n1pdm09_confirmed');
export const GeoCodeSchema = z.string().regex(/^([A-Z]{3}|BR-[A-Z]{2,2}|BR-(N|NE|SE|S|CO))$/, 'BRA, BR-SP ou BR-SE').describe('Código geográfico: BRA (Brasil) ou UF como BR-SP');
export const PeriodSchema = z.string().regex(/^\d{4}(-W\d{2})?$/, 'AAAA ou AAAA-Www').describe('Período AAAA-Www (ex.: 2026-W30) ou AAAA');

export interface Citation {
  label: string;
  url: string;
}

function geoLevelOf(geo: string): SeriesParams['geo_level'] {
  if (geo === 'WLD') return 'world';
  if (/^BR-(N|NE|SE|S|CO)$/.test(geo)) return 'region';
  if (/^BR-[A-Z]{2}$/.test(geo)) return 'state';
  return 'country';
}

function failure(r: { status: string; error: string }, what: string) {
  return { ok: false as const, error: r.status === 'not_found' ? `${what}: não encontrado.` : `${what}: dado indisponível no momento.`, detail: r.error };
}

function totalObs(r: SeriesResult): SeriesObservation[] {
  return r.observations.filter((o) => Object.keys(o.stratum).length === 0).sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}

function seriesMeta(d: SeriesResult) {
  return {
    indicator: { id: d.indicator.id, name: d.indicator.name, unit: d.indicator.unit, period_type: d.indicator.period_type },
    source: { id: d.source.id, name: d.source.name, agency: d.source.agency, url: d.source.url, license: d.meta.license },
    data_as_of: d.meta.data_as_of,
    universe_note: d.meta.universe_note,
    case_definition: d.meta.case_definition,
    suppression_threshold: d.meta.suppression_threshold,
    caveats: d.meta.caveats.slice(0, 4),
    citations: [
      { label: d.source.name, url: d.source.url },
      { label: 'Observatório H1N1 no Brasil', url: `/dados/brasil/?indicador=${d.indicator.id}` },
    ] as Citation[],
  };
}

function point(o: SeriesObservation) {
  return {
    period: o.period,
    period_start: o.period_start,
    period_end: o.period_end,
    value: o.suppressed ? null : o.value,
    suppressed: o.suppressed,
    display: o.suppressed ? '<5' : o.value === null ? 'sem dado' : String(o.value),
    update_status: o.update_status,
  };
}

export const assistantTools = {
  listar_indicadores: tool({
    description: 'Lista os indicadores disponíveis (id, nome, fonte, unidade, universo). Use para descobrir o id antes de obter_serie.',
    inputSchema: z.object({ filtro: z.string().max(60).optional().describe('Trecho do id ou do nome para filtrar') }),
    execute: async ({ filtro }) => {
      const r = await getIndicators();
      const list = r.ok ? r.data.data : INDICATORS.map((i) => ({ ...i, geo_levels: [...i.geo_levels], caveats: [...i.caveats] }));
      const f = filtro?.toLowerCase();
      const rows = list
        .filter((i) => !f || i.id.includes(f) || i.name.toLowerCase().includes(f))
        .map((i) => ({ id: i.id, name: i.name, source_id: i.source_id, unit: i.unit, geo_levels: i.geo_levels, universe_note: i.universe_note }));
      return { ok: true as const, origin: r.ok ? 'api' : 'ontologia local (API indisponível)', count: rows.length, indicators: rows, citations: [{ label: 'Metodologia e dicionário', url: '/dados/metodologia/' }] as Citation[] };
    },
  }),

  obter_serie: tool({
    description: 'Série semanal publicada de um indicador para uma geografia (padrão BRA). Devolve até 26 pontos mais recentes com fonte, base e universo.',
    inputSchema: z.object({
      indicator: IndicatorIdSchema,
      geo_code: GeoCodeSchema.default('BRA'),
      from: PeriodSchema.optional(),
      to: PeriodSchema.optional(),
    }),
    execute: async ({ indicator, geo_code, from, to }) => {
      const r: ApiResult<SeriesResult> = await getSeries({ indicator, geo_level: geoLevelOf(geo_code), geo_code, from, to });
      if (!r.ok) return failure(r, `série ${indicator}`);
      const obs = totalObs(r.data);
      const shown = obs.slice(-MAX_SERIES_POINTS);
      return {
        ok: true as const,
        geo_code,
        count: obs.length,
        shown: shown.length,
        points: shown.map(point),
        has_provisional: shown.some((o) => o.update_status === 'provisional'),
        ...seriesMeta(r.data),
      };
    },
  }),

  ultimo_valor: tool({
    description: 'Último valor publicado (não suprimido) de um indicador em uma geografia, com a semana, fonte, base e universo.',
    inputSchema: z.object({ indicator: IndicatorIdSchema, geo_code: GeoCodeSchema.default('BRA') }),
    execute: async ({ indicator, geo_code }) => {
      const r = await getSeries({ indicator, geo_level: geoLevelOf(geo_code), geo_code });
      if (!r.ok) return failure(r, `último valor ${indicator}`);
      const obs = totalObs(r.data);
      const last = [...obs].reverse().find((o) => !o.suppressed && o.value !== null) ?? null;
      const previous = last ? obs.filter((o) => o.period < last.period && !o.suppressed && o.value !== null).slice(-4).map(point) : [];
      return {
        ok: true as const,
        geo_code,
        last: last ? point(last) : null,
        previous_weeks: previous,
        note: last ? undefined : obs.length ? 'todas as células recentes estão suprimidas ou sem valor' : 'sem observações publicadas',
        ...seriesMeta(r.data),
      };
    },
  }),

  nowcast: tool({
    description: 'Estimativa de nowcast (correção do atraso de notificação) de /v1/analytics/nowcast para indicadores sivep_* de contagem. É estimativa com intervalo, não contagem. Pode estar indisponível (404).',
    inputSchema: z.object({ indicator: IndicatorIdSchema, geo_code: GeoCodeSchema.default('BRA') }),
    execute: async ({ indicator, geo_code }) => {
      const r = await getNowcast(indicator, geo_code);
      if (!r.ok) return { ok: false as const, available: false, error: 'nowcast indisponível para esta consulta', detail: r.error };
      const d = r.data;
      return {
        ok: true as const,
        available: true,
        indicator: d.indicator,
        geo_code,
        delay: d.delay ? { period: d.delay.period, n: d.delay.n } : null,
        results: d.results.slice(0, 13),
        note: d.note,
        source_id: d.meta.source_id,
        data_as_of: d.meta.data_as_of,
        universe_note: d.meta.universe_note,
        warning: 'nowcast é estimativa estatística com incerteza, não dado observado',
        citations: [{ label: 'Observatório H1N1 no Brasil', url: `/dados/brasil/?indicador=${d.indicator.id}` }] as Citation[],
      };
    },
  }),

  sinais_ears: tool({
    description: 'Sinais estatísticos EARS C1/C2/C3 de /v1/analytics/ears por UF (padrão: todas as UFs do indicador sivep_srag_ah1n1pdm09_confirmed). Sinal estatístico, não surto confirmado. Pode estar indisponível.',
    inputSchema: z.object({ indicator: IndicatorIdSchema.default('sivep_srag_ah1n1pdm09_confirmed'), geo_code: GeoCodeSchema.optional().describe('UF específica (BR-SP) ou BRA; omitir = todas as UFs') }),
    execute: async ({ indicator, geo_code }) => {
      const r = await getEars({ indicator, geo_level: geo_code === 'BRA' ? 'country' : 'state', geo_code: geo_code && geo_code !== 'BRA' ? geo_code : undefined });
      if (!r.ok) return { ok: false as const, available: false, error: 'sinais EARS indisponíveis no momento', detail: r.error, warning: 'sinal estatístico, não surto confirmado' };
      const d = r.data;
      const flagged = d.results.filter((x) => x.flags.length > 0);
      return {
        ok: true as const,
        available: true,
        indicator: d.indicator,
        method: d.method,
        evaluated: d.results.length,
        signals: flagged.slice(0, 30).map((x) => ({ geo_code: x.geo_code, name: x.name, period: x.period, value: x.value, provisional: x.provisional, c1: x.c1, c2: x.c2, c3: x.c3, flags: x.flags })),
        source_id: d.meta.source_id,
        data_as_of: d.meta.data_as_of,
        universe_note: d.meta.universe_note,
        warning: d.method.note || 'sinal estatístico, não surto confirmado',
        citations: [{ label: 'Observatório H1N1 no Brasil', url: `/dados/brasil/?indicador=${d.indicator.id}` }] as Citation[],
      };
    },
  }),

  frescor: tool({
    description: 'Frescor dos indicadores (/v1/freshness): data da base, idade em dias e se está defasado (> 14 dias).',
    inputSchema: z.object({}),
    execute: async () => {
      const r = await getFreshness();
      if (!r.ok) return failure(r, 'frescor');
      return {
        ok: true as const,
        rows: r.data.data.map((f) => ({ indicator_id: f.indicator_id, source_id: f.source_id, data_as_of: f.data_as_of, age_days: f.age_days, stale: f.age_days !== null && f.age_days > 14 })),
        citations: [{ label: 'Fontes oficiais', url: '/dados/fontes/' }] as Citation[],
      };
    },
  }),

  fontes: tool({
    description: 'Catálogo de fontes oficiais (/v1/sources), opcionalmente por prioridade P0, P1 ou P2.',
    inputSchema: z.object({ prioridade: z.enum(['P0', 'P1', 'P2']).optional() }),
    execute: async ({ prioridade }) => {
      const r = await getSources({ priority: prioridade });
      if (!r.ok) return failure(r, 'fontes');
      return {
        ok: true as const,
        count: r.data.data.length,
        sources: r.data.data.slice(0, 40).map((s) => ({ id: s.id, name: s.name, agency: s.agency, priority: s.priority, url: s.url, license: s.license, h1n1_scope: s.h1n1_scope, update_cadence: s.update_cadence })),
        citations: [{ label: 'Fontes oficiais', url: '/dados/fontes/' }] as Citation[],
      };
    },
  }),

  buscar_paginas: tool({
    description: 'Busca páginas do site (título, resposta resumida, descrição) para citar com link interno.',
    inputSchema: z.object({ consulta: z.string().min(2).max(200) }),
    execute: async ({ consulta }) => {
      let hits: ReturnType<typeof searchPages> = [];
      try {
        hits = searchPages(consulta, 5);
      } catch (err) {
        return { ok: false as const, error: 'busca indisponível', detail: err instanceof Error ? err.message : String(err) };
      }
      return { ok: true as const, count: hits.length, pages: hits.map((h) => ({ title: h.title, url: h.url, summary_answer: h.summary_answer, description: h.description })), citations: hits.map((h) => ({ label: h.title, url: h.url })) as Citation[] };
    },
  }),

  glossario: tool({
    description: 'Definição de um termo do glossário do site (ex.: SRAG, influenza A, A(H1N1)pdm09, FluNet, RT-PCR).',
    inputSchema: z.object({ termo: z.string().min(1).max(60) }),
    execute: async ({ termo }) => {
      const t = getGlossaryTerm(termo);
      if (t) return { ok: true as const, term: t.term, short: t.short, definition: t.definition };
      const key = termo.trim().toLowerCase();
      const near = Object.keys(GLOSSARY).filter((k) => k.includes(key) || key.includes(k)).slice(0, 5);
      return { ok: false as const, error: `termo '${termo}' não está no glossário`, available: near.length ? near : Object.keys(GLOSSARY).slice(0, 12) };
    },
  }),
};

export type AssistantTools = typeof assistantTools;
export const ASSISTANT_TOOL_NAMES = Object.keys(assistantTools) as Array<keyof AssistantTools>;
