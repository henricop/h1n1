'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import { feature } from 'topojson-client';
import { polygonToCells } from 'h3-js';
import type { Feature, Geometry } from 'geojson';
import type { GlobeCountry } from '@/lib/api';
import { COUNTRIES_TOPOJSON_URL } from '@/lib/geo-urls';
import { escapeHtml } from '@/lib/html';
import { sqrtRadius } from '@/lib/map-scale';

interface Props {
  countries: GlobeCountry[];
  /** Índice relativo ao array `values` dos países (já descontado o deslocamento da janela carregada). */
  weekIndex: number;
  week: string;
  max: number;
  reducedMotion: boolean;
  /** Pausa a rotação automática (ex.: durante o replay). */
  playing: boolean;
  dataAsOf: string;
  onReady?: () => void;
}

function h3Accepts(geom: Geometry): boolean {
  try {
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    for (const poly of polys) polygonToCells(poly as number[][][], 3, true);
    return true;
  } catch {
    return false;
  }
}

interface Point { iso3: string; name: string; lat: number; lng: number; value: number; t: number }

const nf = new Intl.NumberFormat('pt-BR');

/** Globo WebGL (react-globe.gl) em fundo claro: esfera cinza-azulada fosca, hexágonos cobalto para o Brasil, pontos rosa ∝ √detecções. */
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
        // O H3 (hexágonos do three-globe) rejeita algumas geometrias do atlas 110m (ex.: polígonos que
        // cruzam a linha de data ou a Antártida). Testamos cada feição antes de entregá-la ao globo.
        setLand(fc.features.filter((f) => f.id !== '010' && h3Accepts(f.geometry)));
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

  // Esfera cinza-azulada clara e fosca (sem emissivo, sem brilho): "luz de estúdio" do DESIGN.md.
  const material = useMemo(() => new MeshPhongMaterial({ color: '#dfe6f2', emissive: '#f5f7fb', emissiveIntensity: 0.35, shininess: 2 }), []);

  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    if (weekIndex < 0) return out;
    for (const c of countries) {
      const v = c.values[weekIndex] ?? null;
      if (v === null || v <= 0) continue;
      out.push({ iso3: c.iso3, name: c.name, lat: c.lat, lng: c.lon, value: v, t: max > 0 ? Math.sqrt(v / max) : 0 });
    }
    return out;
  }, [countries, weekIndex, max]);

  const rings = useMemo(() => (reducedMotion ? [] : [...points].sort((a, b) => b.value - a.value).slice(0, 10)), [points, reducedMotion]);

  const onGlobeReady = () => {
    const g = ref.current;
    if (!g) return;
    g.pointOfView({ lat: -8, lng: -50, altitude: 2.1 }, 0);
    const c = g.controls();
    c.enableZoom = false;
    c.autoRotate = !reducedMotion;
    c.autoRotateSpeed = 0.3;
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

  const safeWeek = escapeHtml(week);
  const safeAsOf = escapeHtml(dataAsOf);

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
        atmosphereColor="#9db7ff"
        atmosphereAltitude={0.12}
        hexPolygonsData={land}
        hexPolygonResolution={3}
        hexPolygonMargin={0.55}
        hexPolygonUseDots
        hexPolygonAltitude={0.004}
        hexPolygonColor={(d: object) => ((d as Feature).id === '076' ? '#2451d6' : '#b9c6dc')}
        hexPolygonsTransitionDuration={0}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: object) => 0.02 + (d as Point).t * 0.4}
        pointRadius={(d: object) => 0.25 + (d as Point).t * 1.1}
        pointColor={() => 'rgba(214,0,127,0.85)'}
        pointsMerge={false}
        pointsTransitionDuration={reducedMotion ? 0 : 220}
        pointLabel={(d: object) => {
          const p = d as Point;
          return `<div style="font-family:Inter,system-ui,sans-serif;font-size:13px;background:#ffffff;border:1px solid #e3e8f0;padding:8px 10px;border-radius:12px;color:#0b1220;box-shadow:0 8px 30px -12px rgba(11,18,32,.18)"><strong>${escapeHtml(p.name)}</strong><br/>${nf.format(p.value)} detecções A(H1N1)pdm09<br/><span style="color:#4a5568">${safeWeek} · FluNet · OMS · base de ${safeAsOf}</span></div>`;
        }}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringAltitude={0.01}
        ringMaxRadius={(d: object) => 1.2 + (d as Point).t * 6}
        ringPropagationSpeed={(d: object) => 0.8 + (d as Point).t * 1.2}
        ringRepeatPeriod={1100}
        ringColor={() => (t: number) => `rgba(214,0,127,${Math.max(0, 0.45 - t * 0.45)})`}
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
