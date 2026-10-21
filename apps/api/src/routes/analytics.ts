import type { FastifyInstance } from 'fastify';
import { COUNTRY_BY_ISO3, epiWeek, epiWeekStart, isoWeek, isoWeekStart, parseIsoDate, parseWeekPeriodId } from '@h1n1/core';
import { ears, nowcast, seasonOverlay, EARS_DEFAULTS, NOWCAST_MAX_DELAY_WEEKS, type EarsPoint } from '@h1n1/analytics';
import { getSeries } from '@h1n1/db';
import type { PublishedObservation } from '@h1n1/core';
import { parseOr400, earsQuery, nowcastQuery, seasonsQuery, inferGeoLevel } from '../schemas.js';
import { ApiError, notFound, badRequest } from '../errors.js';
import { EARS_QUERY, EARS_RESPONSE, NOWCAST_QUERY, NOWCAST_RESPONSE, SEASONS_QUERY, SEASONS_RESPONSE, errorResponses } from '../openapi.js';
import { vizMeta, indicatorRef, requireIndicator, alignToAxis, requireComplete, type VizRouteOptions } from './viz.js';

export const DELAY_INDICATOR = 'sivep_reporting_delay_cdf';
export const EARS_METHOD_NAME = 'EARS C1/C2/C3 (CDC), adaptado a semanas';
export const EARS_NOTE = 'sinal estatístico, não surto confirmado; semanas provisórias subestimam';
export const NOWCAST_NOTE =
  'Estimativa, não contagem: projeta o total final das últimas semanas a partir da distribuição empírica de atraso de ' +
  'digitação (sivep_reporting_delay_cdf) da janela de referência; o intervalo cobre só a incerteza da proporção reportada. ' +
  'Semanas com share >= 0.98 são tratadas como completas. Aproximação: assume para o indicador a mesma distribuição de ' +
  'atraso da base de SRAG por influenza (CLASSI_FIN = 1) da qual a CDF é calculada; subtipos, UTI e óbitos podem ter ' +
  'atraso próprio (óbitos, em especial, dependem do fechamento do caso).';

/**
 * Indicadores cuja população é a mesma da CDF de atraso (SRAG por influenza, CLASSI_FIN = 1) — ou um subconjunto dela.
 * Fora desta lista (notificações de SRAG de qualquer agente, percentuais, FluNet…) o nowcast não se aplica.
 */
export const NOWCAST_INDICATORS: ReadonlySet<string> = new Set([
  'sivep_srag_influenza_confirmed',
  'sivep_srag_ah1n1pdm09_confirmed',
  'sivep_srag_ah3n2_confirmed',
  'sivep_srag_inf_a_not_subtyped',
  'sivep_srag_influenza_icu',
  'sivep_srag_influenza_deaths',
  'sivep_srag_ah1n1pdm09_deaths',
]);

/** Semanas decorridas entre o período e a data da base, pela convenção de semana do indicador. */
export function weeksBetween(period: string, dataAsOf: string, periodType: string): number {
  const { year, week } = parseWeekPeriodId(period);
  const base = parseIsoDate(dataAsOf);
  const DAY = 86_400_000;
  if (periodType === 'isoweek') {
    const b = isoWeek(base);
    return Math.round((isoWeekStart(b.year, b.week).getTime() - isoWeekStart(year, week).getTime()) / (7 * DAY));
  }
  const b = epiWeek(base);
  return Math.round((epiWeekStart(b.year, b.week).getTime() - epiWeekStart(year, week).getTime()) / (7 * DAY));
}

export async function analyticsRoutes(app: FastifyInstance, opts: VizRouteOptions) {
  const { db } = opts;
  const limit = opts.rowLimit ?? 100000;

  const geoNames = async (): Promise<Map<string, string>> => {
    const rows = (await db.query<{ code: string; name: string }>('select code, name from geo')).rows;
    return new Map(rows.map((r) => [r.code, r.name]));
  };
  const nameOf = (names: Map<string, string>, code: string) => names.get(code) ?? COUNTRY_BY_ISO3.get(code)?.name ?? code;

  app.get('/v1/analytics/ears', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['análise'],
      summary: 'Detecção de aberração EARS C1/C2/C3 (CDC) sobre a série publicada',
      description:
        'Para cada geo, calcula C1 (z-score vs baseline), C2 (idem com guarda) e C3 (acúmulo de excessos de C2) nas `weeks` semanas ' +
        'mais recentes da série total (sem estrato). Sem geo_code e com geo_level=state, avalia todas as UFs. Valores suprimidos ' +
        'entram como null (nunca revelados). Resultado ordenado por c2 desc. Sinal estatístico, não surto confirmado; semanas ' +
        'provisórias subestimam. 400 too_many_rows se a leitura exceder o limite de linhas. Cache 300 s + ETag.',
      querystring: EARS_QUERY,
      response: { 200: EARS_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req) => {
    const q = parseOr400(earsQuery, req.query);
    const indicator = await requireIndicator(db, q.indicator);
    const geoLevel = q.geo_level ?? (q.geo_code ? inferGeoLevel(q.geo_code) : 'country');
    if (!indicator.geo_levels.includes(geoLevel)) {
      throw new ApiError(400, 'validation_error', `geo_level: o indicador ${indicator.id} não tem nível ${geoLevel}`);
    }
    const baseline = q.baseline ?? EARS_DEFAULTS.baseline;
    const guard = q.guard ?? EARS_DEFAULTS.guard;
    const weeks = q.weeks ?? 12;
    const r = await getSeries(db, { indicator: indicator.id, geoLevel, limit, ...(q.geo_code ? { geoCode: q.geo_code } : {}) });
    if (!r) throw notFound(`Indicador não encontrado: ${q.indicator}`);
    requireComplete(r, 'ears');
    const axis = [...new Set(r.observations.map((o) => o.period))].sort();
    const byGeo = new Map<string, PublishedObservation[]>();
    for (const o of r.observations) {
      const arr = byGeo.get(o.geo_code);
      if (arr) arr.push(o);
      else byGeo.set(o.geo_code, [o]);
    }
    const names = await geoNames();
    const results: Array<{
      geo_code: string; name: string; period: string; value: number | null; provisional: boolean;
      c1: number | null; c2: number | null; c3: number | null; flags: EarsPoint['flags'];
    }> = [];
    const start = Math.max(0, axis.length - weeks);
    for (const [geo_code, obs] of byGeo) {
      const a = alignToAxis(obs, axis);
      const stats = ears(a.values, { baseline, guard });
      for (let t = start; t < axis.length; t++) {
        if (!a.present[t]) continue;
        const s = stats[t];
        results.push({
          geo_code, name: nameOf(names, geo_code), period: axis[t]!, value: a.values[t] ?? null, provisional: a.provisional[t] ?? false,
          c1: s?.c1 ?? null, c2: s?.c2 ?? null, c3: s?.c3 ?? null, flags: s?.flags ?? [],
        });
      }
    }
    results.sort((x, y) => {
      if (x.c2 === null && y.c2 !== null) return 1;
      if (x.c2 !== null && y.c2 === null) return -1;
      if (x.c2 !== null && y.c2 !== null && x.c2 !== y.c2) return y.c2 - x.c2;
      if (x.period !== y.period) return x.period < y.period ? 1 : -1;
      return x.geo_code < y.geo_code ? -1 : x.geo_code > y.geo_code ? 1 : 0;
    });
    return {
      indicator: indicatorRef(indicator),
      meta: vizMeta(r),
      method: { name: EARS_METHOD_NAME, baseline, guard, thresholds: { ...EARS_DEFAULTS.thresholds }, note: EARS_NOTE },
      results,
    };
  });

  app.get('/v1/analytics/nowcast', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['análise'],
      summary: 'Nowcast das últimas semanas pela CDF empírica de atraso de notificação (estimativa, não contagem)',
      description:
        'Só indicadores cuja população coincide com a da CDF de atraso (SRAG por influenza, CLASSI_FIN = 1): ' +
        'sivep_srag_influenza_confirmed, sivep_srag_ah1n1pdm09_confirmed, sivep_srag_ah3n2_confirmed, sivep_srag_inf_a_not_subtyped, ' +
        'sivep_srag_influenza_icu, sivep_srag_influenza_deaths, sivep_srag_ah1n1pdm09_deaths; outros respondem 400 ' +
        '{ code: "nowcast_not_applicable" } (e 400 validation_error se o period_type não for semanal). Usa a publicação vigente de ' +
        'sivep_reporting_delay_cdf para a geo (13 estratos delay_weeks 0..12); sem ela responde 404 { code: "nowcast_unavailable" }. ' +
        'weeks_ago é contado entre a semana epidemiológica do período e a de meta.data_as_of. estimated = observed / reported_share; ' +
        'intervalo pelo erro padrão binomial da share; semanas com share >= 0.98 saem sem correção. A aproximação (mesma distribuição ' +
        'de atraso da base de SRAG por influenza) está documentada em note. 400 too_many_rows se a leitura exceder o limite de linhas. ' +
        'Cache 300 s + ETag.',
      querystring: NOWCAST_QUERY,
      response: { 200: NOWCAST_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req) => {
    const q = parseOr400(nowcastQuery, req.query);
    const indicator = await requireIndicator(db, q.indicator);
    if (!NOWCAST_INDICATORS.has(indicator.id)) {
      throw new ApiError(
        400,
        'nowcast_not_applicable',
        `indicator: o nowcast só se aplica a indicadores com a mesma população da CDF de atraso (SRAG por influenza, CLASSI_FIN = 1): ` +
          `${[...NOWCAST_INDICATORS].join(', ')}`,
      );
    }
    if (indicator.period_type !== 'epiweek' && indicator.period_type !== 'isoweek') {
      throw badRequest(`indicator: o nowcast só aceita indicadores semanais (period_type epiweek/isoweek); ${indicator.id} é ${indicator.period_type}`);
    }
    const geoCode = q.geo_code ?? 'BRA';
    const geoLevel = inferGeoLevel(geoCode);
    const weeks = q.weeks ?? 8;

    const delay = await getSeries(db, { indicator: DELAY_INDICATOR, geoLevel, geoCode, includeStrata: true, limit });
    const unavailable = () =>
      new ApiError(404, 'nowcast_unavailable', `Sem publicação vigente de ${DELAY_INDICATOR} para ${geoCode}; nowcast indisponível.`);
    if (!delay) throw unavailable();
    requireComplete(delay, 'nowcast (CDF de atraso)');
    if (delay.observations.length === 0) throw unavailable();
    // último período (ano) com os 13 estratos delay_weeks completos e não suprimidos
    const byPeriod = new Map<string, Map<number, PublishedObservation>>();
    for (const o of delay.observations) {
      const d = Number(o.stratum.delay_weeks);
      if (!Number.isInteger(d) || d < 0 || d > NOWCAST_MAX_DELAY_WEEKS) continue;
      let m = byPeriod.get(o.period);
      if (!m) { m = new Map(); byPeriod.set(o.period, m); }
      m.set(d, o);
    }
    let chosen: { period: string; cdf: number[]; n: number | null } | null = null;
    for (const period of [...byPeriod.keys()].sort().reverse()) {
      const cells = byPeriod.get(period)!;
      const cdf: number[] = [];
      let n: number | null = null;
      let ok = true;
      for (let d = 0; d <= NOWCAST_MAX_DELAY_WEEKS; d++) {
        const c = cells.get(d);
        if (!c || c.value === null) { ok = false; break; }
        cdf.push(c.value);
        if (c.denominator !== null) n = c.denominator;
      }
      if (ok) { chosen = { period, cdf, n }; break; }
    }
    if (!chosen) throw unavailable();

    const series = await getSeries(db, { indicator: indicator.id, geoLevel, geoCode, limit });
    if (!series) throw notFound(`Indicador não encontrado: ${q.indicator}`);
    requireComplete(series, 'nowcast');
    const obs = [...series.observations].sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0)).slice(-weeks);
    const baseDate = series.meta.data_as_of;
    const lastPeriod = obs[obs.length - 1]?.period;
    const inputs = obs.map((o) => ({
      period: o.period,
      value: o.suppressed ? null : o.value,
      weeksAgo: baseDate ? weeksBetween(o.period, baseDate, indicator.period_type) : lastPeriod ? weeksBetween(o.period, periodStartOf(lastPeriod), 'epiweek') : 0,
    }));
    const results = nowcast(inputs, chosen.cdf, chosen.n ?? 0);
    return {
      indicator: indicatorRef(indicator),
      meta: vizMeta(series),
      delay: { period: chosen.period, n: chosen.n, cdf: chosen.cdf, source_indicator: DELAY_INDICATOR },
      results,
      note: NOWCAST_NOTE,
    };
  });

  app.get('/v1/analytics/seasons', {
    config: { cache: 'series', etag: true },
    schema: {
      tags: ['análise'],
      summary: 'Sobreposição de temporadas: uma linha por ano (ou por temporada SE 27 → SE 26), 53 semanas',
      description:
        'Reorganiza a série total publicada (sem estrato) da geo em linhas com 53 posições; semanas sem dado ficam null. ' +
        'group=calendar (padrão): uma linha por ano, weeks = 1..53, label "2025". group=season: uma linha por temporada ' +
        'de influenza do hemisfério sul, da SE 27 de um ano à SE 26 do seguinte, weeks = 27..53,1..26, label "2025/26" e ' +
        'year = ano inicial. Só indicadores semanais (epiweek/isoweek; 400 caso contrário). 400 too_many_rows se a leitura ' +
        'exceder o limite de linhas. Cache 300 s + ETag.',
      querystring: SEASONS_QUERY,
      response: { 200: SEASONS_RESPONSE, ...errorResponses(400, 404) },
    },
  }, async (req) => {
    const q = parseOr400(seasonsQuery, req.query);
    const indicator = await requireIndicator(db, q.indicator, {
      ok: (i) => i.period_type === 'epiweek' || i.period_type === 'isoweek',
      message: 'a sobreposição de temporadas só aceita indicadores semanais',
    });
    const geoCode = q.geo_code ?? 'BRA';
    const geoLevel = inferGeoLevel(geoCode);
    const group = q.group ?? 'calendar';
    const r = await getSeries(db, {
      indicator: indicator.id, geoLevel, geoCode, limit, ...(q.from_year ? { from: `${q.from_year}-W01` } : {}),
    });
    if (!r) throw notFound(`Indicador não encontrado: ${q.indicator}`);
    requireComplete(r, 'seasons');
    const overlay = seasonOverlay(
      r.observations.map((o) => ({ period: o.period, value: o.suppressed ? null : o.value })),
      { group },
    );
    return { indicator: indicatorRef(indicator), meta: vizMeta(r), geo_code: geoCode, ...overlay };
  });
}

/** Data (domingo) de início da semana epidemiológica de um período AAAA-Www. */
function periodStartOf(period: string): string {
  const { year, week } = parseWeekPeriodId(period);
  return epiWeekStart(year, week).toISOString().slice(0, 10);
}
