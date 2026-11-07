import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import type { GlobeCountry } from '@/lib/api';
import { loadCountryFeatures } from '@/lib/geo-assets';
import { sqrtRadius } from '@/lib/map-scale';
import { formatDateBR } from '@/lib/format';

interface Props {
  countries: GlobeCountry[];
  weekIndex: number;
  week: string;
  max: number;
  dataAsOf: string | null;
  indicatorName: string;
}

/**
 * Pôster estático do globo (SVG renderizado no servidor, projeção ortográfica voltada para o Brasil), sobre papel:
 * fallback em telas pequenas, dispositivos sem WebGL e enquanto o globo 3D carrega. Sem rede em runtime.
 */
export async function GlobePoster({ countries, weekIndex, week, max, dataAsOf, indicatorName }: Props) {
  const size = 640;
  const projection = geoOrthographic()
    .rotate([53, 12])
    .translate([size / 2, size / 2])
    .scale(size / 2 - 8)
    .clipAngle(90);
  const path = geoPath(projection).digits(1);
  const fc = await loadCountryFeatures();
  const land = fc ? fc.features.map((f) => ({ id: String(f.id ?? ''), d: path(f) ?? '' })).filter((f) => f.d) : [];
  const graticule = path(geoGraticule10()) ?? '';
  const sphere = path({ type: 'Sphere' }) ?? '';
  const dots = countries
    .map((c) => {
      const v = c.values[weekIndex] ?? null;
      const p = projection([c.lon, c.lat]);
      if (!p || v === null || v <= 0) return null;
      const r = sqrtRadius(v, max, 26, 2.5);
      return { iso3: c.iso3, name: c.name, x: p[0], y: p[1], r, v, visible: isVisible(c.lon, c.lat, -53, -12) };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null && d.visible);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label={`${indicatorName} por país na semana ${week}, pôster estático do globo voltado para o Brasil; valores na tabela abaixo.`}>
        <defs>
          <radialGradient id="poster-sphere" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#fbfaf7" />
            <stop offset="70%" stopColor="#ece8df" />
            <stop offset="100%" stopColor="#ddd6c6" />
          </radialGradient>
          <radialGradient id="poster-atmo" cx="50%" cy="50%" r="50%">
            <stop offset="86%" stopColor="#cfc4a9" stopOpacity="0" />
            <stop offset="100%" stopColor="#cfc4a9" stopOpacity="0.45" />
          </radialGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill="url(#poster-atmo)" />
        <path d={sphere} fill="url(#poster-sphere)" stroke="#b9b3a4" strokeWidth={1} />
        <path d={graticule} fill="none" stroke="#e2dccd" strokeWidth={0.5} />
        {land.map((f) => (
          <path key={f.id} d={f.d} fill={f.id === '076' ? '#2451d6' : '#c9c1ac'} fillOpacity={f.id === '076' ? 0.85 : 1} stroke="#fbfaf7" strokeWidth={0.5} />
        ))}
        {dots.map((d) => (
          <g key={d.iso3}>
            <circle cx={d.x} cy={d.y} r={d.r * 1.8} fill="#d6007f" fillOpacity={0.1} />
            <circle cx={d.x} cy={d.y} r={d.r} fill="#d6007f" fillOpacity={0.75} stroke="#fbfaf7" strokeWidth={0.8}>
              <title>{`${d.name}: ${new Intl.NumberFormat('pt-BR').format(d.v)} detecções na semana ${week}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 font-mono text-[14px] text-muted">
        Pôster estático · {week} · raio ∝ √detecções · FluNet · OMS · base de {formatDateBR(dataAsOf)}
      </figcaption>
    </figure>
  );
}

/** Ponto visível no hemisfério centrado em (lon0, lat0)? (produto escalar dos vetores unitários > 0) */
function isVisible(lon: number, lat: number, lon0: number, lat0: number): boolean {
  const r = Math.PI / 180;
  const a = [Math.cos(lat * r) * Math.cos(lon * r), Math.cos(lat * r) * Math.sin(lon * r), Math.sin(lat * r)];
  const b = [Math.cos(lat0 * r) * Math.cos(lon0 * r), Math.cos(lat0 * r) * Math.sin(lon0 * r), Math.sin(lat0 * r)];
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! > 0.05;
}
