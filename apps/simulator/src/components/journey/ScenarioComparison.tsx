import type { JourneyLogEntry, JourneySnapshot, ScenarioId } from '../../journey/types';
import { CHART_METRICS, TrajectoryChart } from './TrajectoryChart';
import { formatJourneyHour } from './TimelineControls';
import { formatNumber } from '../../i18n';
import './journey-panels.css';

export interface ScenarioComparisonProps { A: JourneySnapshot; B: JourneySnapshot; active: ScenarioId; onSelect: (id: ScenarioId) => void; onShowEvent: (entry: JourneyLogEntry) => void }
const stageLabels: Record<JourneySnapshot['body']['stage'], string> = { exposure: 'Exposição', local: 'Atividade local', response: 'Resposta imune', recovering: 'Reparo do tecido', worsening: 'Agravamento ilustrativo', controlled: 'Atividade controlada' };

export function ScenarioComparison({ A, B, active, onSelect, onShowEvent }: ScenarioComparisonProps) {
  const lastB = [...B.log].reverse().find((entry) => entry.simulatedHour <= B.simulatedHour);
  const number = (value: number) => formatNumber(value, 1);
  return <section className="journey-panel journey-comparison" aria-labelledby="scenario-comparison-title" data-testid="scenario-comparison">
    <header className="journey-panel-heading"><div><h2 id="scenario-comparison-title">O que mudou com o evento?</h2><p>{formatJourneyHour(A.simulatedHour)}. Mesmo início, duas trajetórias simuladas.</p><details className="journey-comparison-setup"><summary>Configuração compartilhada</summary><p>Mesmas condições iniciais e seed {A.config.seed}. A comparação não prevê o futuro de uma pessoa.</p></details></div></header>
    <div className="journey-scenario-cards">{([A, B] as const).map((snapshot) => <article key={snapshot.scenarioId} className={`journey-scenario-card ${active === snapshot.scenarioId ? 'is-selected' : ''}`}>
      <div className="journey-scenario-card-title"><span className={`journey-scenario-badge is-${snapshot.scenarioId}`}>{snapshot.scenarioId}</span><div><h3>{snapshot.scenarioId === 'A' ? 'Evolução original' : 'Cenário modificado'}</h3><span>{snapshot.scenarioId === 'A' ? 'Condições iniciais preservadas' : `${snapshot.events.filter((event) => event.enabled).length} ${snapshot.events.filter((event) => event.enabled).length === 1 ? 'evento habilitado' : 'eventos habilitados'}`}</span></div><button type="button" className="journey-small-button" aria-pressed={active === snapshot.scenarioId} onClick={() => onSelect(snapshot.scenarioId)}>Ver cenário {snapshot.scenarioId}</button></div>
      <p className="journey-scenario-stage">{stageLabels[snapshot.body.stage]}</p>
      <dl className="journey-scenario-indices">{CHART_METRICS.map((metric) => <div key={metric.key}><dt><i style={{ background: metric.color }} />{metric.label}</dt><dd>{number(snapshot.body[metric.key])}<span>/100</span></dd></div>)}</dl>
      <details className="journey-outcome-times"><summary>Momentos da trajetória</summary><span>Recuperação ilustrativa: <strong>{snapshot.body.recoveryHour !== null ? formatJourneyHour(snapshot.body.recoveryHour) : 'ainda não observada'}</strong></span><span>Agravamento ilustrativo: <strong>{snapshot.body.worseningHour !== null ? formatJourneyHour(snapshot.body.worseningHour) : 'ainda não observado'}</strong></span></details>
    </article>)}</div>
    <div className="journey-comparison-deltas" aria-label="Diferenças entre cenários">{CHART_METRICS.map((metric) => {
      const delta = B.body[metric.key] - A.body[metric.key];
      return <div key={metric.key}><span>{metric.label}</span><strong>{Math.abs(delta) < .05 ? 'Sem diferença' : `${delta > 0 ? '+' : '−'}${number(Math.abs(delta))}`}</strong><small>{Math.abs(delta) < .05 ? 'no horário selecionado' : 'pontos internos · B menos A'}</small></div>;
    })}</div>
    <TrajectoryChart A={A.history} B={B.history} hour={A.simulatedHour} horizonHours={A.config.horizonDays * 24} />
    {lastB && <details className="journey-comparison-explanation"><summary>Por quê?</summary><div><p>{lastB.explanation}</p><span>Fatores registrados: {lastB.relatedFactors.join(' · ') || 'estado local da região'}.</span></div><button type="button" className="journey-text-button" onClick={() => onShowEvent(lastB)}>Mostrar o que aconteceu ↗</button></details>}
  </section>;
}
