/**
 * Malhas geográficas servidas de public/geo (baixadas uma vez; nunca buscadas em runtime de outra origem).
 * - br-uf.geojson: malha de UFs do IBGE (qualidade mínima; propriedade `codarea` = código IBGE de 2 dígitos).
 * - countries-110m.json: world-atlas TopoJSON (Natural Earth 110m), para os hexágonos do globo.
 * Leitura no servidor (fs) para o pôster e para passar as features ao cliente; URL pública para o globo.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { BR_STATE_BY_IBGE } from '@h1n1/core';

export { BR_UF_GEOJSON_URL, COUNTRIES_TOPOJSON_URL } from './geo-urls';

export interface UfFeatureProps { codarea: string; uf: string; name: string }
export type UfFeature = Feature<Geometry, UfFeatureProps>;

let ufCache: Promise<FeatureCollection<Geometry, UfFeatureProps> | null> | null = null;

/** Malha de UFs com `uf` e `name` resolvidos a partir de BR_STATES (null se o arquivo faltar). */
export function loadBrUfFeatures(): Promise<FeatureCollection<Geometry, UfFeatureProps> | null> {
  if (!ufCache) {
    ufCache = (async () => {
      try {
        const raw = await readFile(path.join(process.cwd(), 'public', 'geo', 'br-uf.geojson'), 'utf8');
        const fc = JSON.parse(raw) as FeatureCollection<Geometry, { codarea: string }>;
        const features: UfFeature[] = fc.features
          .map((f) => {
            const st = BR_STATE_BY_IBGE.get(String(f.properties?.codarea ?? ''));
            if (!st) return null;
            return { type: 'Feature' as const, geometry: f.geometry, properties: { codarea: st.ibge, uf: st.uf, name: st.name } };
          })
          .filter((f): f is UfFeature => f !== null);
        return { type: 'FeatureCollection', features };
      } catch (err) {
        console.error(`[geo] malha de UFs indisponível: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    })();
  }
  return ufCache;
}

let countriesCache: Promise<FeatureCollection<Geometry, { name?: string }> | null> | null = null;

/** Países (world-atlas 110m → GeoJSON) para o pôster do globo renderizado no servidor. ids = ISO 3166-1 numérico. */
export function loadCountryFeatures(): Promise<FeatureCollection<Geometry, { name?: string }> | null> {
  if (!countriesCache) {
    countriesCache = (async () => {
      try {
        const [{ feature }, raw] = await Promise.all([import('topojson-client'), readFile(path.join(process.cwd(), 'public', 'geo', 'countries-110m.json'), 'utf8')]);
        const topo = JSON.parse(raw) as Parameters<typeof feature>[0];
        const obj = (topo.objects as Record<string, Parameters<typeof feature>[1]>).countries;
        if (!obj) return null;
        return feature(topo, obj) as unknown as FeatureCollection<Geometry, { name?: string }>;
      } catch (err) {
        console.error(`[geo] malha de países indisponível: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    })();
  }
  return countriesCache;
}
