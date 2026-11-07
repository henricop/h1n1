'use client';
import { useEffect, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { BR_STATE_BY_IBGE } from '@h1n1/core';
import { BR_UF_GEOJSON_URL } from '@/lib/geo-urls';
import type { UfFeatureProps } from '@/lib/geo-assets';

let cached: FeatureCollection<Geometry, UfFeatureProps> | null = null;
let inflight: Promise<FeatureCollection<Geometry, UfFeatureProps> | null> | null = null;

/**
 * Malha de UFs (IBGE, servida de public/geo) carregada uma vez no cliente; `codarea` → sigla/nome via BR_STATES.
 * `enabled = false` (caminhos já vindos do servidor) não busca nada.
 */
export function useBrUfFeatures(enabled = true): { features: FeatureCollection<Geometry, UfFeatureProps> | null; failed: boolean } {
  const [features, setFeatures] = useState(cached);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || cached) return;
    inflight ??= fetch(BR_UF_GEOJSON_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((fc: FeatureCollection<Geometry, { codarea: string }>) => {
        const out: FeatureCollection<Geometry, UfFeatureProps> = {
          type: 'FeatureCollection',
          features: fc.features.flatMap((f) => {
            const st = BR_STATE_BY_IBGE.get(String(f.properties?.codarea ?? ''));
            return st ? [{ type: 'Feature' as const, geometry: f.geometry, properties: { codarea: st.ibge, uf: st.uf, name: st.name } }] : [];
          }),
        };
        cached = out;
        return out;
      })
      .catch(() => null);
    let alive = true;
    inflight.then((fc) => {
      if (!alive) return;
      if (fc) setFeatures(fc);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { features, failed };
}
