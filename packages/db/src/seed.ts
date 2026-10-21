import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalog, INDICATORS, BR_STATES, type Source } from '@h1n1/core';
import type { Db } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));

export function loadCatalogFromRepo(): Source[] {
  const p = join(here, '..', '..', '..', 'data', 'sources.json');
  return parseCatalog(JSON.parse(readFileSync(p, 'utf8')));
}

export async function seedSources(db: Db, sources: Source[] = loadCatalogFromRepo()): Promise<number> {
  for (const s of sources) {
    await db.query(
      `insert into sources (id, slug, name, agency, country, region, category, access, access_type, h1n1_scope,
         update_cadence, priority, url, notes, license, mirror_group, api_tested_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (id) do update set slug=excluded.slug, name=excluded.name, agency=excluded.agency,
         country=excluded.country, region=excluded.region, category=excluded.category, access=excluded.access,
         access_type=excluded.access_type, h1n1_scope=excluded.h1n1_scope, update_cadence=excluded.update_cadence,
         priority=excluded.priority, url=excluded.url, notes=excluded.notes, license=excluded.license,
         mirror_group=excluded.mirror_group, api_tested_at=excluded.api_tested_at`,
      [s.id, s.slug, s.name, s.agency, s.country, s.region, s.category, s.access, s.access_type, s.h1n1_scope,
        s.update_cadence, s.priority, s.url, s.notes, s.license, s.mirror_group, s.api_tested_at],
    );
  }
  return sources.length;
}

export async function seedIndicators(db: Db): Promise<number> {
  for (const i of INDICATORS) {
    await db.query(
      `insert into indicators (id, name, description, source_id, case_definition, measurement, unit, universe_note,
         methodology_version, geo_levels, period_type, event_date_basis, stratum_schema, mirror_group,
         suppression_threshold, denominator_indicator_id, min_denominator, caveats)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       on conflict (id) do update set name=excluded.name, description=excluded.description, source_id=excluded.source_id,
         case_definition=excluded.case_definition, measurement=excluded.measurement, unit=excluded.unit,
         universe_note=excluded.universe_note, methodology_version=excluded.methodology_version,
         geo_levels=excluded.geo_levels, period_type=excluded.period_type, event_date_basis=excluded.event_date_basis,
         stratum_schema=excluded.stratum_schema, mirror_group=excluded.mirror_group,
         suppression_threshold=excluded.suppression_threshold, denominator_indicator_id=excluded.denominator_indicator_id,
         min_denominator=excluded.min_denominator, caveats=excluded.caveats`,
      [i.id, i.name, i.description, i.source_id, i.case_definition, i.measurement, i.unit, i.universe_note,
        i.methodology_version, [...i.geo_levels], i.period_type, i.event_date_basis, JSON.stringify(i.stratum_schema),
        i.mirror_group, i.suppression_threshold, i.denominator_indicator_id, i.min_denominator, [...i.caveats]],
    );
  }
  return INDICATORS.length;
}

export async function seedGeo(db: Db): Promise<number> {
  const rows: Array<[string, string, string, string | null, string | null, string | null]> = [
    ['WLD', 'world', 'Mundo', null, null, null],
    ['BRA', 'country', 'Brasil', 'WLD', null, 'BR'],
    ['GBR', 'country', 'Reino Unido', 'WLD', null, 'GB'],
    ['ENG', 'country', 'Inglaterra', 'GBR', null, null],
    ['USA', 'country', 'Estados Unidos', 'WLD', null, 'US'],
    // Regiões usam prefixo BR-R- para não colidir com UFs (BR-SE é Sergipe).
    ['BR-R-N', 'region', 'Norte', 'BRA', '1', null],
    ['BR-R-NE', 'region', 'Nordeste', 'BRA', '2', null],
    ['BR-R-SE', 'region', 'Sudeste', 'BRA', '3', null],
    ['BR-R-S', 'region', 'Sul', 'BRA', '4', null],
    ['BR-R-CO', 'region', 'Centro-Oeste', 'BRA', '5', null],
    ...BR_STATES.map((s): [string, string, string, string, string, null] => [`BR-${s.uf}`, 'state', s.name, `BR-R-${s.region}`, s.ibge, null]),
  ];
  for (const [code, level, name, parent, ibge, iso2] of rows) {
    await db.query(
      `insert into geo (code, level, name, parent_code, ibge_id, iso2) values ($1,$2,$3,$4,$5,$6)
       on conflict (code) do update set level=excluded.level, name=excluded.name, parent_code=excluded.parent_code,
         ibge_id=excluded.ibge_id, iso2=excluded.iso2`,
      [code, level, name, parent, ibge, iso2],
    );
  }
  return rows.length;
}

export async function seedAll(db: Db): Promise<{ sources: number; indicators: number; geo: number }> {
  const sources = await seedSources(db);
  const indicators = await seedIndicators(db);
  const geo = await seedGeo(db);
  return { sources, indicators, geo };
}
