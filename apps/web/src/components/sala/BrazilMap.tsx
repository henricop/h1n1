'use client';
import { useId, useMemo, useState } from 'react';
import type { MapState } from '@/lib/api';
import { CHART_COLORS } from '@/lib/echarts-theme';
import { formatNumberBR, formatPeriod } from '@/lib/format';
import { legendStops, mapCell, MAP_COLOR_ZERO, textOn, type MapCell } from '@/lib/map-scale';
import { LABEL, NOTE, SUMMARY, TABLE } from '@/components/charts/ui';
import { buildUfPaths, MAP_H, MAP_W, type UfPath } from './uf-paths';
import { useBrUfFeatures } from './useBrUfFeatures';

interface Props {
  states: MapState[];
  weekIndex: number;
  week: string;
  /** Escala (maior valor publicado): fixa no período carregado (animação comparável entre semanas) ou da semana exibida. */
  max: number;
  unit: string;
  threshold: number;
  indicatorName: string;
  provisional: boolean;
  /** Caminhos calculados no servidor (`loadUfPaths`): o SVG sai no HTML inicial. Sem eles a malha é buscada em /geo. */
  paths?: UfPath[];
  /** Como `max` foi calculado (só altera o texto da legenda). */
  scale?: 'period' | 'week';
  /** UF destacada (contorno). */
  selectedUf?: string | null;
  /** Se informado, cada UF vira um link (teclado e toque). Modelo de endereço com `{uf}` (string: funções não cruzam servidor → cliente). */
  ufHref?: string;
  /** Seletor de UF por formulário GET (alternativa acessível ao clique no mapa). */
  ufForm?: { action: string; hidden?: Record<string, string>; selected?: string | null; label?: string; submitLabel?: string };
}

const LABEL_MIN_WIDTH = 30;

function cellText(c: MapCell, value: number | null, unit: string, threshold: number): string {
  if (c.kind === 'suppressed') return `<${threshold}, ocultado por privacidade`;
  if (c.kind === 'nodata') return 'sem dado publicado';
  return formatNumberBR(value, unit);
}

/**
 * Mapa de UFs em SVG (d3-geo, Mercator ajustado ao Brasil), colorido pela semana.
 * "<5" = hachurado + legenda "<5, ocultado por privacidade"; "sem dado" = pontilhado, distinto; zero = cor própria.
 * Sem ranking e sem geolocalização. Equivalente acessível: tabela "Ver como tabela" (ordem alfabética) e seletor de UF.
 */
export function BrazilMap({ states, weekIndex, week, max, unit, threshold, indicatorName, provisional, paths: serverPaths, scale = 'period', selectedUf = null, ufHref, ufForm }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hs = `hs-${uid}`;
  const dn = `dn-${uid}`;
  const tableId = `tabela-mapa-${uid}`;
  const [hover, setHover] = useState<string | null>(null);
  const { features, failed } = useBrUfFeatures(!serverPaths);
  const paths = useMemo<UfPath[]>(() => serverPaths ?? (features ? buildUfPaths(features) : []), [serverPaths, features]);
  const byUf = useMemo(() => new Map(states.map((s) => [s.uf, s])), [states]);
  const cellOf = (uf: string): { cell: MapCell; value: number | null } => {
    const s = byUf.get(uf);
    const value = s?.values[weekIndex] ?? null;
    return { cell: mapCell(value, s?.suppressed[weekIndex] ?? false, max), value };
  };
  const fillOf = (c: MapCell) => (c.kind === 'suppressed' ? `url(#${hs})` : c.kind === 'nodata' ? `url(#${dn})` : c.fill);
  const stops = legendStops(max);
  const periodText = week ? formatPeriod(week) : '';
  const hovered = hover ? byUf.get(hover) : undefined;
  const hoveredPath = hover ? paths.find((p) => p.uf === hover) : undefined;
  const hoveredCell = hover ? cellOf(hover) : null;
  const sortedStates = useMemo(() => [...states].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [states]);

  return (
    <div className="@container relative">
      {/* padrões (hachura e pontilhado) definidos uma vez e usados pelo mapa e pela legenda */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
        <defs>
          <pattern id={hs} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill={CHART_COLORS.card} />
            <line x1="0" y1="0" x2="0" y2="7" stroke={CHART_COLORS.faint} strokeWidth="1.8" />
          </pattern>
          <pattern id={dn} width="9" height="9" patternUnits="userSpaceOnUse">
            <rect width="9" height="9" fill="#ece8df" />
            <circle cx="4.5" cy="4.5" r="1.2" fill={CHART_COLORS.lineStrong} />
          </pattern>
        </defs>
      </svg>

      <div className="grid gap-x-10 gap-y-2 @3xl:grid-cols-[minmax(0,1fr)_20rem] @3xl:items-start">
        {paths.length === 0 ? (
          <div
            className="relative flex w-full items-center justify-center rounded-2xl border border-line bg-bg-soft px-4 text-center"
            style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
            role="status"
            aria-live="polite"
          >
            <p className={NOTE}>{failed ? 'Malha de UFs indisponível; use a tabela abaixo.' : 'Carregando malha de UFs…'}</p>
          </div>
        ) : (
          <div className="relative mx-auto w-full max-w-[640px]">
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-auto w-full" role="group" aria-label={`Mapa do Brasil por UF: ${indicatorName}${periodText ? `, ${periodText}` : ''}`}>
              {paths.map((p) => {
                const { cell: c, value: v } = cellOf(p.uf);
                const label = cellText(c, v, unit, threshold);
                const isSel = selectedUf === p.uf;
                const common = {
                  className: 'uf-path',
                  fill: fillOf(c),
                  style: isSel ? { stroke: CHART_COLORS.ink, strokeWidth: 2.4 } : undefined,
                  onMouseEnter: () => setHover(p.uf),
                  onMouseLeave: () => setHover(null),
                  onFocus: () => setHover(p.uf),
                  onBlur: () => setHover(null),
                };
                const name = `${p.name} (${p.uf}): ${label}${provisional && c.kind === 'value' ? ', provisório' : ''}`;
                return ufHref ? (
                  <a key={p.uf} href={ufHref.replace('{uf}', p.uf)} aria-label={`${name}. Abrir esta UF.`} aria-current={isSel ? 'true' : undefined}>
                    <path d={p.d} {...common} style={{ ...common.style, cursor: 'pointer' }}>
                      <title>{`${p.name} (${p.uf}): ${label}`}</title>
                    </path>
                  </a>
                ) : (
                  <path key={p.uf} d={p.d} {...common} tabIndex={0} role="img" aria-label={name} onClick={() => setHover((h) => (h === p.uf ? null : p.uf))}>
                    <title>{`${p.name} (${p.uf}): ${label}`}</title>
                  </path>
                );
              })}
              {paths
                .filter((p) => p.w >= LABEL_MIN_WIDTH)
                .map((p) => {
                  const { cell: c } = cellOf(p.uf);
                  const onPattern = c.kind === 'suppressed' || c.kind === 'nodata';
                  const fill = c.kind === 'value' ? textOn(c.fill) : CHART_COLORS.ink;
                  return (
                    <text
                      key={`t-${p.uf}`}
                      x={p.cx}
                      y={p.cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={600}
                      fill={fill}
                      stroke={onPattern ? CHART_COLORS.card : undefined}
                      strokeWidth={onPattern ? 3 : undefined}
                      paintOrder="stroke"
                      className="font-mono"
                      pointerEvents="none"
                      aria-hidden="true"
                    >
                      {p.uf}
                    </text>
                  );
                })}
            </svg>
            {hover && hovered && hoveredPath && hoveredCell && (
              <div
                role="tooltip"
                className="card pointer-events-none absolute z-10 px-3 py-2 text-[14px] leading-snug text-ink"
                style={{ left: `${(hoveredPath.cx / MAP_W) * 100}%`, top: `${(hoveredPath.cy / MAP_H) * 100}%`, transform: 'translate(-50%, -125%)' }}
              >
                <p className="font-semibold">
                  {hovered.name} ({hovered.uf})
                </p>
                <p>
                  {hoveredCell.cell.kind === 'suppressed'
                    ? `<${threshold}, ocultado por privacidade`
                    : hoveredCell.cell.kind === 'nodata'
                      ? 'sem dado publicado'
                      : formatNumberBR(hoveredCell.value, unit)}
                  {provisional && hoveredCell.cell.kind === 'value' ? <span className="text-attention-700"> · provisório</span> : null}
                </p>
                {periodText && <p className="text-muted">{periodText}</p>}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0">
          <ul className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 @3xl:mt-2 @3xl:flex-col @3xl:items-start ${NOTE}`} aria-label="Legenda do mapa">
            <li className="inline-flex items-center gap-2">
              <Swatch fill={MAP_COLOR_ZERO} /> 0
            </li>
            {stops.map((s) => (
              <li key={s.value} className="inline-flex items-center gap-2">
                <Swatch fill={s.fill} /> {formatNumberBR(s.value, unit)}
              </li>
            ))}
            <li className="inline-flex items-center gap-2">
              <Swatch fill={`url(#${hs})`} /> {`<${threshold}, ocultado por privacidade`}
            </li>
            <li className="inline-flex items-center gap-2">
              <Swatch fill={`url(#${dn})`} /> sem dado publicado
            </li>
          </ul>
          <p className={`mt-2 ${NOTE}`}>
            {stops.length === 0
              ? 'Nenhuma UF com valor acima de zero na semana exibida.'
              : `Intensidade da cor proporcional à raiz quadrada do valor; escala ${scale === 'week' ? 'da semana exibida' : 'fixa no período carregado'} (máx. ${formatNumberBR(max, unit)}).`}
            {provisional ? ' Semana provisória: os valores tendem a subir em revisões.' : ''}
          </p>

          <details className="mt-4">
            <summary className={SUMMARY}>Ver como tabela</summary>
            <div className="mt-3 max-h-96 overflow-auto scroll-thin">
              <table id={tableId} className={TABLE}>
                <caption>
                  {indicatorName} por UF{periodText ? `, ${periodText}` : ''} (ordem alfabética)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">UF</th>
                    <th scope="col" className="text-right!">
                      Valor
                    </th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStates.map((s) => {
                    const { cell: c, value } = cellOf(s.uf);
                    return (
                      <tr key={s.uf}>
                        <th scope="row" className="font-normal">
                          {s.name} ({s.uf})
                        </th>
                        <td className="num">{c.kind === 'suppressed' ? `<${threshold}` : c.kind === 'nodata' ? 'sem dado' : formatNumberBR(value, unit)}</td>
                        <td>{c.kind === 'suppressed' ? 'ocultado por privacidade' : c.kind === 'nodata' ? 'sem dado publicado' : provisional ? 'provisória' : 'consolidada'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>

          {ufForm && (
            <form method="get" action={ufForm.action} className="mt-5 flex flex-wrap items-end gap-3" aria-label="Escolher uma UF por lista">
              {Object.entries(ufForm.hidden ?? {}).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <div>
                <label htmlFor={`uf-${uid}`} className={`block ${LABEL}`}>
                  {ufForm.label ?? 'Prefere uma lista? Escolha a UF'}
                </label>
                <select id={`uf-${uid}`} name="uf" defaultValue={ufForm.selected ?? ''} className="select-field mt-1 min-w-[14rem]">
                  <option value="">Brasil (todas)</option>
                  {sortedStates.map((s) => (
                    <option key={s.uf} value={s.uf}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn">
                {ufForm.submitLabel ?? 'Ver esta UF'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** Amostra da legenda: cor chapada ou padrão (hachura/pontilhado) definido no SVG oculto do mapa. */
function Swatch({ fill }: { fill: string }) {
  return (
    <svg width="22" height="22" aria-hidden="true" focusable="false" className="shrink-0">
      <rect width="22" height="22" rx="4" fill={fill} stroke={CHART_COLORS.lineStrong} strokeWidth="1" />
    </svg>
  );
}
