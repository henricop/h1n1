// Gera fixtures realistas no formato exato da API (/v1/*) a partir do catálogo e da ontologia do @h1n1/core.
// Uso: node test/fixtures/generate.mjs  (determinístico; não acessa rede)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const core = await import(path.join(root, 'packages/core/dist/index.js'));
const { INDICATORS, SOURCE_SLUGS, mirrorGroupOf, BR_STATES, stateGeoCode, epiWeekStart, isoWeekStart, isoWeek, COUNTRY_BY_ISO3 } = core;

const OUT = path.join(here, 'api');
mkdirSync(OUT, { recursive: true });

const DATA_AS_OF_SIVEP = '2026-10-13';
const FETCHED_AT_SIVEP = '2026-10-14T06:12:44.000Z';
const DATA_AS_OF_FLUNET = '2026-10-12';
const FETCHED_AT_FLUNET = '2026-10-13T03:40:10.000Z';

// PRNG determinístico
let seed = 20261020;
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// ---------- sources ----------
const catalog = JSON.parse(readFileSync(path.join(root, 'data/sources.json'), 'utf8'));
const sources = catalog.sources.map((s) => ({
  id: s.id,
  slug: SOURCE_SLUGS[s.id] ?? s.id.toLowerCase().replace('-', '_'),
  name: s.name,
  agency: s.agency,
  country: s.country,
  region: s.region,
  category: s.category,
  access: s.access,
  access_type: s.access_type,
  h1n1_scope: s.h1n1_scope,
  update_cadence: s.update_cadence,
  priority: s.priority,
  url: s.url,
  notes: s.notes,
  license: s.license,
  mirror_group: mirrorGroupOf(s.id),
  api_tested_at: s.api_tested_2026_10_20 ? '2026-10-20' : null,
}));
writeFileSync(path.join(OUT, 'sources.json'), JSON.stringify({ data: sources }, null, 1));

// ---------- indicators ----------
const indicators = INDICATORS.map((i) => ({ ...i, geo_levels: [...i.geo_levels], caveats: [...i.caveats] }));
writeFileSync(path.join(OUT, 'indicators.json'), JSON.stringify({ data: indicators }, null, 1));

// ---------- geo ----------
writeFileSync(
  path.join(OUT, 'geo.json'),
  JSON.stringify(
    {
      data: [
        { code: 'WLD', level: 'world', name: 'Mundo', parent_code: null, ibge_id: null, iso2: null },
        { code: 'BRA', level: 'country', name: 'Brasil', parent_code: 'WLD', ibge_id: null, iso2: 'BR' },
        ...[['N', 'Norte'], ['NE', 'Nordeste'], ['SE', 'Sudeste'], ['S', 'Sul'], ['CO', 'Centro-Oeste']].map(([c, n]) => ({ code: `BR-${c}`, level: 'region', name: n, parent_code: 'BRA', ibge_id: null, iso2: null })),
        ...BR_STATES.map((s) => ({ code: stateGeoCode(s.uf), level: 'state', name: s.name, parent_code: `BR-${s.region}`, ibge_id: s.ibge, iso2: null })),
      ],
    },
    null,
    1,
  ),
);

// ---------- séries ----------
// Semanas epidemiológicas brasileiras: 2025-W40 .. 2026-W41 (SE da base de 2026-10-13)
function brWeeks() {
  const weeks = [];
  for (let w = 40; w <= 52; w++) weeks.push({ year: 2025, week: w });
  for (let w = 1; w <= 41; w++) weeks.push({ year: 2026, week: w });
  return weeks.map(({ year, week }) => {
    const start = epiWeekStart(year, week);
    return { period: `${year}-W${String(week).padStart(2, '0')}`, period_start: iso(start), period_end: iso(addDays(start, 6)) };
  });
}
function isoWeeks() {
  const weeks = [];
  for (let w = 40; w <= 52; w++) weeks.push({ year: 2025, week: w });
  for (let w = 1; w <= 41; w++) weeks.push({ year: 2026, week: w });
  return weeks.map(({ year, week }) => {
    const start = isoWeekStart(year, week);
    return { period: `${year}-W${String(week).padStart(2, '0')}`, period_start: iso(start), period_end: iso(addDays(start, 6)) };
  });
}

// Curva sazonal: pico entre abril e julho (SE 15-28), vale no verão.
function seasonal(idx, n, peak, floor) {
  const x = idx / n; // 0..1
  const bump = Math.exp(-Math.pow((x - 0.58) / 0.16, 2));
  return floor + peak * bump;
}

const STATE_WEIGHT = Object.fromEntries(
  BR_STATES.map((s) => [s.uf, ({ SP: 0.26, MG: 0.09, RJ: 0.08, PR: 0.08, RS: 0.07, SC: 0.05, BA: 0.05, GO: 0.03, PE: 0.03, CE: 0.03 })[s.uf] ?? 0.012]),
);

function sivepSeries(indId, peakNational, floorNational, withAge) {
  const weeks = brWeeks();
  const obs = [];
  const provisionalFrom = weeks.length - 4;
  const nat = weeks.map((w, i) => Math.round(seasonal(i, weeks.length, peakNational, floorNational) * (0.85 + rnd() * 0.3)));
  weeks.forEach((w, i) => {
    const provisional = i >= provisionalFrom;
    const v = provisional ? Math.round(nat[i] * (0.35 + 0.15 * (weeks.length - i))) : nat[i];
    obs.push(row('country', 'BRA', w, v, {}, provisional));
    if (withAge) {
      const shares = { '0-4': 0.18, '5-14': 0.1, '15-29': 0.09, '30-49': 0.17, '50-64': 0.18, '65+': 0.26, NA: 0.02 };
      for (const [g, sh] of Object.entries(shares)) obs.push(row('country', 'BRA', w, Math.round(v * sh), { age_group: g }, provisional));
    }
    for (const s of BR_STATES) {
      const sv = Math.round(v * STATE_WEIGHT[s.uf] * (0.7 + rnd() * 0.6));
      obs.push(row('state', stateGeoCode(s.uf), w, sv, {}, provisional));
    }
  });
  return obs.map((o) => ({ ...o, indicator_id: indId }));
}
function row(geo_level, geo_code, w, value, stratum, provisional) {
  // Supressão (<5) em recortes subnacionais/estratificados: valor nunca sai
  const subnational = geo_level !== 'country' || Object.keys(stratum).length > 0;
  const suppressed = subnational && value > 0 && value < 5;
  return {
    geo_level,
    geo_code,
    period: w.period,
    period_start: w.period_start,
    period_end: w.period_end,
    value: suppressed ? null : value,
    denominator: null,
    stratum,
    suppressed,
    update_status: provisional ? 'provisional' : 'final',
    quality_flags: provisional ? ['reporting_delay'] : [],
  };
}

function flunetSeries(indId, peak, floor, shareDenom) {
  const weeks = isoWeeks();
  const obs = [];
  weeks.forEach((w, i) => {
    const provisional = i >= weeks.length - 2;
    let v = Math.round(seasonal(i, weeks.length, peak, floor) * (0.8 + rnd() * 0.4));
    if (provisional) v = Math.round(v * 0.5);
    const r = row('country', 'BRA', w, v, {}, provisional);
    if (shareDenom) {
      const denom = Math.round(v * (1.6 + rnd() * 0.8)) + 5;
      r.denominator = denom;
      r.value = denom >= 20 ? Number(((v / denom) * 100).toFixed(1)) : null;
      if (denom < 20) r.quality_flags = [...r.quality_flags, 'denominator_below_minimum'];
    }
    obs.push({ ...r, indicator_id: indId });
  });
  return obs;
}

const SERIES_SPECS = {
  sivep_srag_notifications: () => sivepSeries('sivep_srag_notifications', 6800, 1400, true),
  sivep_srag_influenza_confirmed: () => sivepSeries('sivep_srag_influenza_confirmed', 1500, 120, true),
  sivep_srag_ah1n1pdm09_confirmed: () => sivepSeries('sivep_srag_ah1n1pdm09_confirmed', 900, 40, true),
  sivep_srag_ah3n2_confirmed: () => sivepSeries('sivep_srag_ah3n2_confirmed', 260, 25, false),
  sivep_srag_inf_a_not_subtyped: () => sivepSeries('sivep_srag_inf_a_not_subtyped', 220, 30, false),
  sivep_srag_influenza_deaths: () => sivepSeries('sivep_srag_influenza_deaths', 190, 12, true),
  sivep_srag_ah1n1pdm09_deaths: () => sivepSeries('sivep_srag_ah1n1pdm09_deaths', 120, 5, true),
  sivep_srag_influenza_icu: () => sivepSeries('sivep_srag_influenza_icu', 420, 35, false),
  flunet_specimens_processed: () => flunetSeries('flunet_specimens_processed', 5200, 1800, false),
  flunet_ah1n1pdm09_detections: () => flunetSeries('flunet_ah1n1pdm09_detections', 640, 30, false),
  flunet_ah3_detections: () => flunetSeries('flunet_ah3_detections', 210, 20, false),
  flunet_inf_a_detections: () => flunetSeries('flunet_inf_a_detections', 980, 70, false),
  flunet_inf_a_not_subtyped: () => flunetSeries('flunet_inf_a_not_subtyped', 130, 15, false),
  flunet_inf_b_detections: () => flunetSeries('flunet_inf_b_detections', 160, 10, false),
  flunet_inf_all_detections: () => flunetSeries('flunet_inf_all_detections', 1140, 80, false),
  flunet_ah1n1pdm09_share_of_inf_a: () => flunetSeries('flunet_ah1n1pdm09_share_of_inf_a', 640, 30, true),
};

const indById = Object.fromEntries(indicators.map((i) => [i.id, i]));
const srcById = Object.fromEntries(sources.map((s) => [s.id, s]));
const freshness = [];

for (const [id, make] of Object.entries(SERIES_SPECS)) {
  const indicator = indById[id];
  const source = srcById[indicator.source_id];
  const isSivep = id.startsWith('sivep_');
  const snapshotId = isSivep ? '7f1c2a8e-sivep-2026-10-14' : 'a93d55b1-flunet-2026-10-13';
  const snapshot = {
    id: snapshotId,
    source_id: source.id,
    url: isSivep
      ? 'https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-13-10-2026.csv'
      : 'https://xmart-api-public.who.int/FLUMART/VIW_FNT?$filter=COUNTRY_CODE%20eq%20%27BRA%27',
    fetched_at: isSivep ? FETCHED_AT_SIVEP : FETCHED_AT_FLUNET,
    sha256: isSivep ? 'c0ffee0b1d4e8f6a9b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f607182' : '9a8b7c6d5e4f30211203a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9',
    bytes: isSivep ? 273_422_118 : 1_204_311,
    content_type: isSivep ? 'text/csv' : 'application/json',
    license: isSivep ? 'CC-BY (portal dadosabertos.saude.gov.br)' : source.license,
    storage_path: isSivep ? 'data/snapshots/BR-03/2026-10-14/INFLUD26-13-10-2026.csv' : 'data/snapshots/INT-01/2026-10-13/VIW_FNT_BRA.json',
    data_as_of: isSivep ? DATA_AS_OF_SIVEP : DATA_AS_OF_FLUNET,
    status: 'ok',
    notes: null,
  };
  const publication = {
    indicator_id: id,
    snapshot_id: snapshotId,
    published_at: isSivep ? '2026-10-14T06:40:02.000Z' : '2026-10-13T04:01:11.000Z',
    data_as_of: snapshot.data_as_of,
    status: 'current',
    validation_report: { checks: ['schema', 'monotonic_periods', 'no_mirror_sum'], passed: true },
  };
  const observations = make();
  const result = {
    indicator,
    source,
    publication,
    snapshot,
    observations,
    meta: {
      data_as_of: snapshot.data_as_of,
      fetched_at: snapshot.fetched_at,
      universe_note: indicator.universe_note,
      case_definition: indicator.case_definition,
      license: snapshot.license,
      suppression_threshold: indicator.suppression_threshold,
      caveats: indicator.caveats,
      count: observations.length,
    },
  };
  writeFileSync(path.join(OUT, `series.${id}.json`), JSON.stringify(result));
  freshness.push({
    indicator_id: id,
    source_id: source.id,
    snapshot_id: snapshotId,
    data_as_of: snapshot.data_as_of,
    fetched_at: snapshot.fetched_at,
    published_at: publication.published_at,
    age_days: isSivep ? 6 : 7,
    last_run_status: 'ok',
    last_run_finished_at: snapshot.fetched_at,
  });
}
// Indicadores sem publicação (ainda não ingeridos)
const EXTRA_SERIES = new Set(['flunet_influenza_positivity']);
for (const i of indicators) {
  if (!SERIES_SPECS[i.id] && !EXTRA_SERIES.has(i.id))
    freshness.push({ indicator_id: i.id, source_id: i.source_id, snapshot_id: null, data_as_of: null, fetched_at: null, published_at: null, age_days: null, last_run_status: null, last_run_finished_at: null });
}
// Um indicador propositalmente defasado para exercitar o selo "Dado defasado" (> 14 dias)
const stale = freshness.find((f) => f.indicator_id === 'sivep_srag_influenza_subtype_completeness');
if (stale) Object.assign(stale, { snapshot_id: 'old-snapshot-2026-09-01', data_as_of: '2026-08-31', fetched_at: '2026-09-01T06:00:00.000Z', published_at: '2026-09-01T06:30:00.000Z', age_days: 49, last_run_status: 'failed', last_run_finished_at: '2026-10-14T06:00:00.000Z' });

// =====================================================================================================
// SALA DE SITUAÇÃO: endpoints novos (/v1/globe, /v1/map/brazil, /v1/analytics/*, /v1/runs, /v1/indicators/:id/latest)
// Seção independente (PRNG re-semeado) para manter as fixtures acima byte-idênticas.
// =====================================================================================================
seed = 20261021;
const readSeries = (id) => JSON.parse(readFileSync(path.join(OUT, `series.${id}.json`), 'utf8'));
const periodId = (y, w) => `${y}-W${String(w).padStart(2, '0')}`;
const isoWeeksInYear = (y) => isoWeek(new Date(Date.UTC(y, 11, 28))).week;

// ---------- série extra: positividade FluNet (percentual = detecções / amostras) ----------
{
  const indicator = indById['flunet_influenza_positivity'];
  const source = srcById[indicator.source_id];
  const all = readSeries('flunet_inf_all_detections');
  const spec = readSeries('flunet_specimens_processed');
  const byPeriod = Object.fromEntries(spec.observations.map((o) => [o.period, o]));
  const observations = all.observations.map((o) => {
    const d = byPeriod[o.period];
    const denom = d?.value ?? null;
    const ok = denom !== null && denom >= 20 && o.value !== null;
    return {
      ...o,
      indicator_id: indicator.id,
      value: ok ? Number(((o.value / denom) * 100).toFixed(1)) : null,
      denominator: denom,
      quality_flags: ok ? o.quality_flags : [...o.quality_flags, 'denominator_below_minimum'],
    };
  });
  const result = { ...all, indicator, source, publication: { ...all.publication, indicator_id: indicator.id }, observations, meta: { ...all.meta, universe_note: indicator.universe_note, case_definition: indicator.case_definition, caveats: indicator.caveats, suppression_threshold: indicator.suppression_threshold, count: observations.length } };
  writeFileSync(path.join(OUT, `series.${indicator.id}.json`), JSON.stringify(result));
  freshness.push({ indicator_id: indicator.id, source_id: source.id, snapshot_id: all.snapshot.id, data_as_of: all.snapshot.data_as_of, fetched_at: all.snapshot.fetched_at, published_at: all.publication.published_at, age_days: 7, last_run_status: 'ok', last_run_finished_at: all.snapshot.fetched_at });
}
writeFileSync(path.join(OUT, 'freshness.json'), JSON.stringify({ data: freshness }, null, 1));

// ---------- /v1/globe: detecções A(H1N1)pdm09 por país e semana ISO, 2009-W01 .. 2026-W41 ----------
{
  const weeks = [];
  for (let y = 2009; y <= 2026; y++) {
    const n = y === 2026 ? 41 : isoWeeksInYear(y);
    for (let w = 1; w <= n; w++) weeks.push(periodId(y, w));
  }
  // [iso3, amplitude relativa, hemisfério (N/S/T=tropical), primeira semana reportada (índice)]
  const SPEC = [
    ['USA', 1.0, 'N', 0], ['MEX', 0.35, 'N', 0], ['CAN', 0.4, 'N', 0], ['BRA', 0.6, 'S', 0], ['ARG', 0.3, 'S', 0], ['CHL', 0.3, 'S', 0],
    ['COL', 0.18, 'T', 0], ['PER', 0.15, 'T', 0], ['ECU', 0.08, 'T', 40], ['PRY', 0.06, 'S', 60], ['URY', 0.05, 'S', 0], ['BOL', 0.04, 'T', 120],
    ['GBR', 0.6, 'N', 0], ['FRA', 0.5, 'N', 0], ['DEU', 0.55, 'N', 0], ['ESP', 0.4, 'N', 0], ['ITA', 0.35, 'N', 0], ['PRT', 0.12, 'N', 0],
    ['NLD', 0.2, 'N', 0], ['BEL', 0.12, 'N', 0], ['SWE', 0.2, 'N', 0], ['NOR', 0.15, 'N', 0], ['DNK', 0.12, 'N', 0], ['FIN', 0.12, 'N', 0],
    ['POL', 0.15, 'N', 20], ['RUS', 0.6, 'N', 0], ['UKR', 0.15, 'N', 30], ['TUR', 0.2, 'N', 0], ['GRC', 0.08, 'N', 0], ['ROU', 0.08, 'N', 50],
    ['IRL', 0.1, 'N', 0], ['CHE', 0.1, 'N', 0], ['AUT', 0.08, 'N', 0], ['CZE', 0.08, 'N', 0], ['ISR', 0.08, 'N', 0], ['IRN', 0.2, 'N', 80],
    ['EGY', 0.12, 'N', 0], ['SAU', 0.1, 'N', 100], ['MAR', 0.06, 'N', 150], ['ZAF', 0.3, 'S', 0], ['KEN', 0.06, 'T', 0], ['NGA', 0.05, 'T', 200],
    ['GHA', 0.04, 'T', 120], ['SEN', 0.04, 'T', 180], ['MDG', 0.05, 'S', 0], ['CMR', 0.03, 'T', 250],
    ['CHN', 0.9, 'N', 0], ['JPN', 0.5, 'N', 0], ['KOR', 0.3, 'N', 0], ['IND', 0.5, 'T', 0], ['THA', 0.15, 'T', 0], ['VNM', 0.1, 'T', 0],
    ['IDN', 0.08, 'T', 50], ['PHL', 0.08, 'T', 0], ['MYS', 0.08, 'T', 0], ['SGP', 0.08, 'T', 0], ['BGD', 0.08, 'T', 30], ['PAK', 0.06, 'N', 90],
    ['AUS', 0.5, 'S', 0], ['NZL', 0.15, 'S', 0], ['HKG', 0.15, 'N', 0], ['TWN', 0.12, 'N', 0], ['MNG', 0.03, 'N', 0], ['LKA', 0.04, 'T', 60],
  ];
  const yearFactor = { 2009: 2.2, 2010: 0.45, 2011: 0.6, 2012: 0.35, 2013: 0.7, 2014: 0.5, 2015: 0.8, 2016: 0.9, 2017: 0.4, 2018: 0.85, 2019: 0.9, 2020: 0.15, 2021: 0.05, 2022: 0.6, 2023: 0.8, 2024: 0.95, 2025: 0.9, 2026: 1.0 };
  const gauss = (x, mu, sd) => Math.exp(-Math.pow((x - mu) / sd, 2));
  const countries = SPEC.map(([iso3, amp, hemi, firstIdx]) => {
    const c = COUNTRY_BY_ISO3.get(iso3);
    const values = weeks.map((p, i) => {
      if (i < firstIdx) return null;
      if (rnd() < 0.02) return null; // semana não reportada
      const y = Number(p.slice(0, 4));
      const w = Number(p.slice(6));
      const nY = isoWeeksInYear(y);
      let shape;
      if (y === 2009) {
        // pandemia: primeira onda a partir da SE 17 (Américas do Norte), segunda onda no outono do hemisfério norte
        const start = hemi === 'S' ? 24 : 17;
        const first = w < start ? 0 : gauss(w, hemi === 'S' ? 30 : 26, hemi === 'S' ? 5 : 4) * (hemi === 'S' ? 1.6 : 0.7);
        const second = hemi === 'N' ? gauss(w, 44, 4) * 1.8 : hemi === 'T' ? gauss(w, 38, 7) * 0.6 : 0;
        shape = (first + second) * (iso3 === 'MEX' || iso3 === 'USA' ? 1.5 : 1);
      } else if (y === 2010 && hemi === 'N' && w < 10) {
        shape = gauss(w, 1, 6) * 0.8; // cauda da segunda onda
      } else {
        const peak = hemi === 'N' ? 6 : hemi === 'S' ? 28 : 36;
        const sd = hemi === 'T' ? 14 : 5;
        const wrapped = Math.min(Math.abs(w - peak), Math.abs(w - peak + nY), Math.abs(w - peak - nY));
        shape = gauss(wrapped, 0, sd) * (hemi === 'T' ? 0.5 : 1);
      }
      const v = shape * amp * 1400 * (yearFactor[y] ?? 0.6) * (0.75 + rnd() * 0.5);
      return Math.max(0, Math.round(v));
    });
    return { iso3, name: c.name, lat: c.lat, lon: c.lon, who_region: c.who_region, values };
  });
  const indicator = indById['flunet_ah1n1pdm09_detections'];
  writeFileSync(
    path.join(OUT, `globe.${indicator.id}.json`),
    JSON.stringify({
      indicator: { id: indicator.id, name: indicator.name },
      meta: { data_as_of: DATA_AS_OF_FLUNET, universe_note: indicator.universe_note, license: 'verify_per_source', source_id: 'INT-01', case_definition: indicator.case_definition },
      weeks,
      countries,
    }),
  );
}

// ---------- /v1/map/brazil: valores por UF e semana, derivados das séries SIVEP já geradas ----------
const MAP_INDICATORS = ['sivep_srag_ah1n1pdm09_confirmed', 'sivep_srag_influenza_confirmed', 'sivep_srag_notifications', 'sivep_srag_ah1n1pdm09_deaths'];
for (const id of MAP_INDICATORS) {
  const s = readSeries(id);
  const nat = s.observations.filter((o) => o.geo_level === 'country' && Object.keys(o.stratum).length === 0);
  const weeks = nat.map((o) => o.period);
  const states = BR_STATES.map((st) => {
    const code = stateGeoCode(st.uf);
    const rows = s.observations.filter((o) => o.geo_code === code);
    const byP = Object.fromEntries(rows.map((o) => [o.period, o]));
    return { code, uf: st.uf, name: st.name, ibge: st.ibge, values: weeks.map((p) => byP[p]?.value ?? null), suppressed: weeks.map((p) => byP[p]?.suppressed ?? false) };
  });
  writeFileSync(
    path.join(OUT, `map.brazil.${id}.json`),
    JSON.stringify({
      indicator: { id: s.indicator.id, name: s.indicator.name },
      meta: { data_as_of: s.meta.data_as_of, universe_note: s.meta.universe_note, license: s.meta.license, source_id: s.source.id, case_definition: s.meta.case_definition },
      weeks,
      states,
      national: { values: nat.map((o) => o.value), provisional: nat.map((o) => o.update_status === 'provisional') },
    }),
  );
}

// ---------- /v1/analytics/ears: C1/C2/C3 por UF (baseline 7 semanas, guarda 2) ----------
{
  const id = 'sivep_srag_ah1n1pdm09_confirmed';
  const s = readSeries(id);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  const cusum = (series, idx, guard) => {
    const base = series.slice(idx - guard - 7, idx - guard).filter((v) => v !== null);
    if (base.length < 5 || series[idx] === null) return null;
    const m = mean(base);
    const d = Math.max(sd(base), 0.5);
    return Number(((series[idx] - m) / d).toFixed(2));
  };
  const results = BR_STATES.map((st) => {
    const code = stateGeoCode(st.uf);
    const rows = s.observations.filter((o) => o.geo_code === code).sort((a, b) => (a.period < b.period ? -1 : 1));
    const vals = rows.map((o) => o.value);
    // avalia a última semana consolidada: semanas provisórias subestimam e não são avaliadas
    const last = rows.findLastIndex((o) => o.update_status === 'final');
    const c1 = cusum(vals, last, 0);
    const c2 = cusum(vals, last, 2);
    const c3 = [0, 1, 2].map((k) => cusum(vals, last - k, 2)).every((v) => v !== null) ? Number([0, 1, 2].reduce((acc, k) => acc + Math.max(0, cusum(vals, last - k, 2) - 1), 0).toFixed(2)) : null;
    const flags = [];
    if (c1 !== null && c1 > 3) flags.push('C1');
    if (c2 !== null && c2 > 3) flags.push('C2');
    if (c3 !== null && c3 > 2) flags.push('C3');
    if (rows[last].suppressed) flags.push('suppressed');
    return { geo_code: code, name: st.name, period: rows[last].period, value: rows[last].value, provisional: rows[last].update_status === 'provisional', c1, c2, c3, flags };
  });
  // garante alguns sinais para exercitar a interface
  const candidates = results.filter((r) => r.value !== null && r.value >= 5).sort((a, b) => b.value - a.value).slice(1, 3);
  candidates.forEach((r, k) => {
    r.c1 = k === 0 ? 3.4 : 2.1; r.c2 = k === 0 ? 3.9 : 3.2; r.c3 = k === 0 ? 2.6 : 1.4;
    r.flags = Array.from(new Set([...r.flags, ...(k === 0 ? ['C1', 'C2', 'C3'] : ['C2'])]));
  });
  writeFileSync(
    path.join(OUT, `ears.${id}.state.json`),
    JSON.stringify({
      indicator: { id: s.indicator.id, name: s.indicator.name },
      meta: { data_as_of: s.meta.data_as_of, universe_note: s.meta.universe_note, license: s.meta.license, source_id: s.source.id, case_definition: s.meta.case_definition },
      method: {
        name: 'EARS C1/C2/C3 (CDC Early Aberration Reporting System)',
        baseline: '7 semanas anteriores',
        guard: '2 semanas (C2/C3)',
        thresholds: 'C1 > 3; C2 > 3; C3 > 2 (desvios-padrão acima da média do baseline)',
        note: 'Sinal estatístico, não surto confirmado. Avaliada a última semana consolidada; semanas provisórias ainda recebem registros e não são avaliadas.',
      },
      results,
    }, null, 1),
  );
}

// ---------- /v1/analytics/nowcast: estimativa de notificações ainda não digitadas (BRA, 8 semanas) ----------
{
  const id = 'sivep_srag_ah1n1pdm09_confirmed';
  const s = readSeries(id);
  const nat = s.observations.filter((o) => o.geo_level === 'country' && Object.keys(o.stratum).length === 0);
  const cdf = [0.36, 0.58, 0.72, 0.81, 0.87, 0.91, 0.94, 0.96, 0.975, 0.985, 0.99, 0.995, 1];
  const results = nat.slice(-8).reverse().map((o, weeks_ago) => {
    const share = cdf[weeks_ago];
    const observed = o.value;
    const estimated = Math.round(observed / share);
    const unc = Math.round(Math.sqrt(estimated) * 2 * (1 - share) * 4 + estimated * (1 - share) * 0.35);
    return { period: o.period, weeks_ago, observed, reported_share: share, estimated, lower: Math.max(observed, estimated - unc), upper: estimated + unc };
  }).reverse();
  writeFileSync(
    path.join(OUT, `nowcast.${id}.BRA.json`),
    JSON.stringify({
      indicator: { id: s.indicator.id, name: s.indicator.name },
      meta: { data_as_of: s.meta.data_as_of, universe_note: s.meta.universe_note, license: s.meta.license, source_id: s.source.id, case_definition: s.meta.case_definition },
      delay: { period: '2025-W40/2026-W33', n: 41, cdf },
      results,
      note: 'Estimativa de notificações ainda não digitadas, a partir da distribuição histórica de atraso entre primeiros sintomas e digitação (método na metodologia). Não é previsão de casos futuros.',
    }, null, 1),
  );
}

// ---------- /v1/analytics/seasons: sobreposição de temporadas (BRA, 2019..2026) ----------
{
  const id = 'sivep_srag_ah1n1pdm09_confirmed';
  const s = readSeries(id);
  const nat = s.observations.filter((o) => o.geo_level === 'country' && Object.keys(o.stratum).length === 0);
  const current = Object.fromEntries(nat.filter((o) => o.period.startsWith('2026-')).map((o) => [Number(o.period.slice(6)), o.value]));
  const amp = { 2019: 520, 2020: 60, 2021: 35, 2022: 640, 2023: 480, 2024: 980, 2025: 700 };
  const weeks = Array.from({ length: 53 }, (_, i) => i + 1);
  const seasons = [];
  for (let y = 2019; y <= 2025; y++) {
    const peakW = 20 + Math.round(rnd() * 8);
    seasons.push({ year: y, values: weeks.map((w) => (w === 53 && isoWeeksInYear(y) < 53 ? null : Math.max(0, Math.round((20 + amp[y] * Math.exp(-Math.pow((w - peakW) / 6.5, 2))) * (0.8 + rnd() * 0.4))))) });
  }
  seasons.push({ year: 2026, values: weeks.map((w) => current[w] ?? null) });
  writeFileSync(
    path.join(OUT, `seasons.${id}.BRA.json`),
    JSON.stringify({
      indicator: { id: s.indicator.id, name: s.indicator.name },
      meta: { data_as_of: s.meta.data_as_of, universe_note: s.meta.universe_note, license: s.meta.license, source_id: s.source.id, case_definition: s.meta.case_definition },
      weeks,
      seasons,
    }),
  );
}

// ---------- /v1/runs: últimas execuções dos conectores ----------
{
  const connectors = [
    ['sivep_gripe', 'BR-03', 273422118, 1812345],
    ['who_flunet', 'INT-01', 1204311, 9284],
    ['ibge_population', 'BR-10', 48211, 27],
    ['who_flunet', 'INT-01', 1198720, 9270],
    ['sivep_gripe', 'BR-03', 271998211, 1809877],
  ];
  const data = [];
  let t = new Date('2026-10-14T06:12:44.000Z').getTime();
  for (let i = 0; i < 30; i++) {
    const [connector, source_id, rows_in, rows_out] = connectors[i % connectors.length];
    const failed = i === 3 || i === 17;
    const skipped = i === 9;
    const started = new Date(t - (connector === 'sivep_gripe' ? 1_900_000 : 240_000));
    data.push({
      id: `run_${String(2026101400 - i * 7).padStart(10, '0')}`,
      connector,
      source_id,
      started_at: started.toISOString(),
      finished_at: new Date(t).toISOString(),
      status: failed ? 'failed' : skipped ? 'skipped' : 'ok',
      rows_in: failed ? 0 : skipped ? 0 : rows_in - Math.round(rnd() * 5000),
      rows_out: failed ? 0 : skipped ? 0 : rows_out - Math.round(rnd() * 50),
      error: failed ? 'HTTP 503 ao baixar o arquivo da fonte; versão anterior mantida (regra 10).' : null,
    });
    t -= 86_400_000 * (i % 2 === 0 ? 1 : 2) + 3_600_000 * (i % 5);
  }
  writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify({ data }, null, 1));
}

// ---------- /v1/indicators/:id/latest ----------
for (const id of ['sivep_srag_ah1n1pdm09_confirmed', 'sivep_srag_influenza_confirmed', 'sivep_srag_ah1n1pdm09_deaths', 'sivep_srag_notifications', 'flunet_ah1n1pdm09_detections']) {
  const s = readSeries(id);
  const nat = s.observations.filter((o) => o.geo_level === 'country' && Object.keys(o.stratum).length === 0);
  const last = nat[nat.length - 1];
  const prev4 = nat.slice(-5, -1).map((o) => o.value).filter((v) => v !== null);
  const avg4 = prev4.length ? prev4.reduce((a, b) => a + b, 0) / prev4.length : null;
  writeFileSync(
    path.join(OUT, `latest.${id}.BRA.json`),
    JSON.stringify({
      indicator: { id: s.indicator.id, name: s.indicator.name },
      geo_code: 'BRA',
      period: last.period,
      period_end: last.period_end,
      value: last.value,
      suppressed: last.suppressed,
      provisional: last.update_status === 'provisional',
      trend_pct_vs_4w: avg4 && last.value !== null ? Number((((last.value - avg4) / avg4) * 100).toFixed(1)) : null,
      data_as_of: s.meta.data_as_of,
    }, null, 1),
  );
}

console.log(`fixtures geradas em ${OUT}: ${Object.keys(SERIES_SPECS).length + 1} séries, ${sources.length} fontes, ${indicators.length} indicadores, globo, mapa (${MAP_INDICATORS.length}), EARS, nowcast, temporadas, runs, latest`);
