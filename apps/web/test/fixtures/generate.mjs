// Gera fixtures realistas no formato exato da API (/v1/*) a partir do catálogo e da ontologia do @h1n1/core.
// Uso: node test/fixtures/generate.mjs  (determinístico; não acessa rede)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const core = await import(path.join(root, 'packages/core/dist/index.js'));
const { INDICATORS, SOURCE_SLUGS, mirrorGroupOf, BR_STATES, stateGeoCode, epiWeekStart, isoWeekStart } = core;

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
for (const i of indicators) {
  if (!SERIES_SPECS[i.id])
    freshness.push({ indicator_id: i.id, source_id: i.source_id, snapshot_id: null, data_as_of: null, fetched_at: null, published_at: null, age_days: null, last_run_status: null, last_run_finished_at: null });
}
// Um indicador propositalmente defasado para exercitar o selo "Dado defasado" (> 14 dias)
const stale = freshness.find((f) => f.indicator_id === 'sivep_srag_influenza_subtype_completeness');
if (stale) Object.assign(stale, { snapshot_id: 'old-snapshot-2026-09-01', data_as_of: '2026-08-31', fetched_at: '2026-09-01T06:00:00.000Z', published_at: '2026-09-01T06:30:00.000Z', age_days: 49, last_run_status: 'failed', last_run_finished_at: '2026-10-14T06:00:00.000Z' });
writeFileSync(path.join(OUT, 'freshness.json'), JSON.stringify({ data: freshness }, null, 1));

console.log(`fixtures geradas em ${OUT}: ${Object.keys(SERIES_SPECS).length} séries, ${sources.length} fontes, ${indicators.length} indicadores`);
