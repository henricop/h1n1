'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import { feature } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { GlobeCountry } from '@/lib/api';
import { COUNTRIES_TOPOJSON_URL } from '@/lib/geo-urls';
import { sqrtRadius } from '@/lib/map-scale';

interface Props {
  countries: GlobeCountry[];
  weekIndex: number;
  week: string;
  max: number;
  reducedMotion: boolean;
  /** Pausa a rotação automática (ex.: durante o replay). */
  playing: boolean;
  dataAsOf: string;
  onReady?: () => void;
}

interface Point { iso3: string; name: string; lat: number; lng: number; value: number; t: number }

const nf = new Intl.NumberFormat('pt-BR');

/** Globo WebGL (react-globe.gl): hexágonos dos países, pontos/anéis magenta ∝ √detecções na semana. */
export default function Globe3D({ countries, weekIndex, week, max, reducedMotion, playing, dataAsOf, onReady }: Props) {
  const ref = useRef<GlobeMethods | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [land, setLand] = useState<Feature<Geometry>[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(COUNTRIES_TOPOJSON_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (!alive) return;
        const fc = feature(topo, topo.objects.countries) as unknown as { features: Feature<Geometry>[] };
        setLand(fc.features);
      })
      .catch(() => setLand([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const material = useMemo(() => new MeshPhongMaterial({ color: '#0d1526', emissive: '#05080f', shininess: 4 }), []);

  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    for (const c of countries) {
      const v = c.values[weekIndex] ?? null;
      if (v === null || v <= 0) continue;
      out.push({ iso3: c.iso3, name: c.name, lat: c.lat, lng: c.lon, value: v, t: max > 0 ? Math.sqrt(v / max) : 0 });
    }
    return out;
  }, [countries, weekIndex, max]);

  const rings = useMemo(() => (reducedMotion ? [] : [...points].sort((a, b) => b.value - a.value).slice(0, 14)), [points, reducedMotion]);

  const onGlobeReady = () => {
    const g = ref.current;
    if (!g) return;
    g.pointOfView({ lat: -8, lng: -50, altitude: 2.1 }, 0);
    const c = g.controls();
    c.enableZoom = false;
    c.autoRotate = !reducedMotion;
    c.autoRotateSpeed = 0.35;
    onReady?.();
  };

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    try {
      g.controls().autoRotate = !reducedMotion && !playing;
    } catch {
      /* controles ainda não prontos */
    }
  }, [reducedMotion, playing]);

  return (
    <div ref={box} className="absolute inset-0" aria-hidden="true">
      <Globe
        ref={ref}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={null}
        globeMaterial={material}
        showAtmosphere
        atmosphereColor="#35e0ff"
        atmosphereAltitude={0.16}
        hexPolygonsData={land}
        hexPolygonResolution={3}
        hexPolygonMargin={0.62}
        hexPolygonUseDots
        hexPolygonAltitude={0.004}
        hexPolygonColor={(d: object) => ((d as Feature).id === '076' ? 'rgba(53,224,255,0.75)' : 'rgba(111,135,170,0.42)')}
        hexPolygonsTransitionDuration={0}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: object) => 0.02 + (d as Point).t * 0.45}
        pointRadius={(d: object) => 0.25 + (d as Point).t * 1.1}
        pointColor={() => 'rgba(255,79,216,0.85)'}
        pointsMerge={false}
        pointsTransitionDuration={reducedMotion ? 0 : 220}
        pointLabel={(d: object) => {
          const p = d as Point;
          return `<div style="font-family:ui-monospace,monospace;font-size:12px;background:rgba(10,15,26,.96);border:1px solid #34507a;padding:8px 10px;border-radius:4px;color:#e6edf7"><strong>${p.name}</strong><br/>${nf.format(p.value)} detecções A(H1N1)pdm09<br/><span style="color:#9fb0c7">${week} · FluNet · OMS · base de ${dataAsOf}</span></div>`;
        }}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringAltitude={0.01}
        ringMaxRadius={(d: object) => 1.2 + (d as Point).t * 7}
        ringPropagationSpeed={(d: object) => 0.8 + (d as Point).t * 1.4}
        ringRepeatPeriod={900}
        ringColor={() => (t: number) => `rgba(255,79,216,${Math.max(0, 0.7 - t * 0.7)})`}
        ringResolution={48}
        rendererConfig={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onGlobeReady={onGlobeReady}
      />
    </div>
  );
}

export function sqrtPointRadius(value: number | null, max: number): number {
  return sqrtRadius(value, max, 1.1, 0.25);
}
