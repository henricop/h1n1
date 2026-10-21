'use client';
import { useMemo, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { MapState } from '@/lib/api';
import { useBrUfFeatures } from './useBrUfFeatures';
import { formatNumberBR } from '@/lib/format';
import { legendStops, mapCell, MAP_COLOR_ZERO } from '@/lib/map-scale';

interface Props {
  states: MapState[];
  weekIndex: number;
  week: string;
  /** Escala fixa (maior valor publicado em todo o período carregado), para a animação ser comparável entre semanas. */
  max: number;
  unit: string;
  threshold: number;
  indicatorName: string;
  provisional: boolean;
}

const W = 560;
const H = 540;

/** Mapa de UFs em SVG (d3-geo, Mercator ajustado ao Brasil), colorido pela semana; "<5" hachurado; tooltip acessível. */
export function BrazilMap({ states, weekIndex, week, max, unit, threshold, indicatorName, provisional }: Props) {
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null);
  const { features, failed } = useBrUfFeatures();
  const paths = useMemo(() => {
    if (!features) return [];
    const proj = geoMercator().fitSize([W, H], features);
    const p = geoPath(proj).digits(1);
    return features.features.map((f) => ({ uf: f.properties.uf, name: f.properties.name, d: p(f) ?? '', c: p.centroid(f) }));
  }, [features]);
  const byUf = useMemo(() => new Map(states.map((s) => [s.uf, s])), [states]);
  const cell = (uf: string) => {
    const s = byUf.get(uf);
    return mapCell(s?.values[weekIndex] ?? null, s?.suppressed[weekIndex] ?? false, max);
  };
  const stops = legendStops(max);
  const hovered = hover ? byUf.get(hover.uf) : null;
  const hoveredCell = hover ? cell(hover.uf) : null;

  if (!features) {
    return (
      <div className="scanlines relative flex w-full items-center justify-center rounded border border-line bg-bg-950/60" style={{ aspectRatio: `${W} / ${H}` }} role="status" aria-live="polite">
        <p className="font-mono text-xs text-faint">{failed ? 'Malha de UFs indisponível; veja o ranking e a tabela.' : 'Carregando malha de UFs…'}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={`Mapa do Brasil por UF: ${indicatorName}, semana ${week}`}>
        <defs>
          <pattern id="hatch-nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#0f1726" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#34507a" strokeWidth="1.5" />
          </pattern>
        </defs>
        {paths.map((p) => {
          const c = cell(p.uf);
          const s = byUf.get(p.uf);
          const v = s?.values[weekIndex] ?? null;
          const label = c.kind === 'suppressed' ? `menos de ${threshold} (suprimido)` : c.kind === 'nodata' ? 'sem dado publicado' : formatNumberBR(v, unit);
          return (
            <path
              key={p.uf}
              d={p.d}
              className="uf-path"
              fill={c.fill}
              tabIndex={0}
              role="img"
              aria-label={`${p.name} (${p.uf}): ${label}${provisional ? ', provisório' : ''}`}
              onMouseEnter={() => setHover({ uf: p.uf, x: p.c[0], y: p.c[1] })}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover({ uf: p.uf, x: p.c[0], y: p.c[1] })}
              onBlur={() => setHover(null)}
            >
              <title>{`${p.name} (${p.uf}): ${label}`}</title>
            </path>
          );
        })}
        {paths.map((p) => (
          <text key={`t-${p.uf}`} x={p.c[0]} y={p.c[1]} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#e6edf7" fillOpacity={0.85} fontFamily="JetBrains Mono, monospace" pointerEvents="none">
            {p.uf}
          </text>
        ))}
      </svg>
      {hover && hovered && hoveredCell && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded border border-line-strong bg-bg-900/95 px-3 py-2 font-mono text-xs text-ink shadow-lg"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: 'translate(-50%, -120%)' }}
        >
          <p className="font-semibold">
            {hovered.name} ({hovered.uf})
          </p>
          <p>
            {hoveredCell.kind === 'suppressed' ? `<${threshold} (célula suprimida)` : hoveredCell.kind === 'nodata' ? 'sem dado publicado' : formatNumberBR(hovered.values[weekIndex], unit)}
            {provisional && hoveredCell.kind === 'value' ? <span className="text-srag"> · provisório</span> : null}
          </p>
          <p className="text-faint">{week}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-faint" aria-label="Legenda do mapa">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: MAP_COLOR_ZERO }} aria-hidden="true" /> 0
        </span>
        {stops.map((s) => (
          <span key={s.value} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.fill }} aria-hidden="true" /> {formatNumberBR(s.value, unit)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" aria-hidden="true">
            <rect width="12" height="12" fill="url(#hatch-nodata)" />
          </svg>
          {'<'}
          {threshold} suprimido ou sem dado
        </span>
        <span>escala √ fixa no período (máx. {formatNumberBR(max, unit)})</span>
      </div>
    </div>
  );
}
