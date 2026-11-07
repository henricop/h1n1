import { useId } from 'react';
import type { HistoryPoint } from '../../journey/types';
import { formatNumber } from '../../i18n';
import './journey-panels.css';

export interface TrajectoryChartProps { A: HistoryPoint[]; B?: HistoryPoint[]; hour: number; horizonHours: number }
export const CHART_METRICS = [
  { key: 'viralActivity', label: 'Atividade viral', color: '#cf587c' },
  { key: 'immuneActivity', label: 'Defesa', color: '#498dbf' },
  { key: 'tissueIntegrity', label: 'Integridade tecidual', color: '#168576' },
  { key: 'inflammation', label: 'Inflamação', color: '#c88936' },
] as const;

export function chartPath(history: HistoryPoint[], key: typeof CHART_METRICS[number]['key'], horizonHours: number): string {
  const safeHorizon = Math.max(1, horizonHours);
  return history.filter((point) => Number.isFinite(point.hour) && Number.isFinite(point[key])).map((point, index) => {
    const x = 44 + Math.max(0, Math.min(1, point.hour / safeHorizon)) * 660;
    const y = 174 - Math.max(0, Math.min(100, point[key])) / 100 * 148;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export function TrajectoryChart({ A, B, hour, horizonHours }: TrajectoryChartProps) {
  const titleId = useId();
  const latestA = [...A].reverse().find((point) => point.hour <= hour);
  const latestB = B && [...B].reverse().find((point) => point.hour <= hour);
  return <figure className="journey-trajectory">
    <figcaption><strong>Como a jornada evolui</strong><span>Escala ilustrativa · 0 a 100</span></figcaption>
    <svg viewBox="0 0 724 210" role="img" aria-labelledby={titleId} className="journey-chart-svg">
      <title id={titleId}>Quatro índices ao longo do tempo: atividade viral, defesa, integridade tecidual e inflamação. Cenário A tracejado; cenário B contínuo.</title>
      {[0, 25, 50, 75, 100].map((value) => <g key={value}><line x1="44" x2="704" y1={174 - value / 100 * 148} y2={174 - value / 100 * 148} stroke="currentColor" opacity=".13" /><text x="33" y={178 - value / 100 * 148} textAnchor="end">{value}</text></g>)}
      {[0, 1 / 4, 1 / 2, 3 / 4, 1].map((fraction) => <text key={fraction} x={44 + fraction * 660} y="198" textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>Dia {Math.round(fraction * horizonHours / 24)}</text>)}
      <line x1={44 + Math.max(0, Math.min(1, hour / Math.max(1, horizonHours))) * 660} x2={44 + Math.max(0, Math.min(1, hour / Math.max(1, horizonHours))) * 660} y1="22" y2="176" stroke="#5f7580" strokeDasharray="2 5" opacity=".4" />
      {CHART_METRICS.map((metric) => <g key={metric.key} fill="none" stroke={metric.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={chartPath(A.filter((point) => point.hour <= hour), metric.key, horizonHours)} strokeDasharray={B ? '6 5' : undefined} opacity={B ? .65 : 1} />{B && <path d={chartPath(B.filter((point) => point.hour <= hour), metric.key, horizonHours)} />}</g>)}
    </svg>
    <div className="journey-chart-legend">{CHART_METRICS.map((metric) => <span key={metric.key}><i style={{ background: metric.color }} />{metric.label}</span>)}{B && <span className="journey-line-legend">A ┄┄ · B ━━</span>}</div>
    <details className="journey-chart-table"><summary>Ver valores na tabela</summary><table className="journey-chart-values"><caption>Valores no horário selecionado</caption><thead><tr><th scope="col">Índice interno</th><th scope="col">Cenário A</th>{B && <th scope="col">Cenário B</th>}</tr></thead><tbody>{CHART_METRICS.map((metric) => <tr key={metric.key}><th scope="row">{metric.label}</th><td>{latestA ? formatNumber(latestA[metric.key],1) : '—'}</td>{B && <td>{latestB ? formatNumber(latestB[metric.key],1) : '—'}</td>}</tr>)}</tbody></table></details>
  </figure>;
}
