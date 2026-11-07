/**
 * Caminhos SVG das UFs (Mercator ajustado ao Brasil). Puro: roda no servidor (SSR do mapa, sem esperar o
 * `fetch` da malha) e no cliente (fallback de `useBrUfFeatures`).
 */
import { geoArea, geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { UfFeatureProps } from '@/lib/geo-assets';

export const MAP_W = 560;
export const MAP_H = 540;

export interface UfPath {
  uf: string;
  name: string;
  /** Atributo `d` do <path>. */
  d: string;
  /** Centroide em unidades do viewBox. */
  cx: number;
  cy: number;
  /** Largura da caixa da UF (decide se cabe o rótulo da sigla). */
  w: number;
}

const reverseRings = (rings: number[][][]): number[][][] => rings.map((r) => [...r].reverse());

/**
 * O d3-geo usa orientação esférica (anel externo horário); a malha do IBGE segue o GeoJSON (RFC 7946, anti-horário).
 * Sem corrigir, cada UF vira o COMPLEMENTO da esfera (área ≈ 4π) e o mapa sai como um retângulo gigante.
 * Inverte os anéis das feições cuja área esférica passa de metade da esfera.
 */
export function rewindForD3(fc: FeatureCollection<Geometry, UfFeatureProps>): FeatureCollection<Geometry, UfFeatureProps> {
  const fix = (f: Feature<Geometry, UfFeatureProps>): Feature<Geometry, UfFeatureProps> => {
    if (geoArea(f) <= 2 * Math.PI) return f;
    const g = f.geometry;
    if (g.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: reverseRings(g.coordinates) } };
    if (g.type === 'MultiPolygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map(reverseRings) } };
    return f;
  };
  return { ...fc, features: fc.features.map(fix) };
}

export function buildUfPaths(raw: FeatureCollection<Geometry, UfFeatureProps>): UfPath[] {
  const features = rewindForD3(raw);
  const proj = geoMercator().fitSize([MAP_W, MAP_H], features);
  const p = geoPath(proj).digits(1);
  return features.features.map((f) => {
    const [cx, cy] = p.centroid(f);
    const [[x0], [x1]] = p.bounds(f);
    return { uf: f.properties.uf, name: f.properties.name, d: p(f) ?? '', cx: Number(cx.toFixed(1)), cy: Number(cy.toFixed(1)), w: Number((x1 - x0).toFixed(1)) };
  });
}
