import { patientState } from '../../journey/patientState';
import { useJourney } from '../../journey/store';
import { formatNumber } from '../../i18n';
import './patient-monitor.css';

export function PatientMonitor({ viralRate, onViralRate }: { viralRate: number; onViralRate: (rate: number) => void }) {
  const { snapshot } = useJourney();
  const person = patientState(snapshot);
  const rates = [1, 1.5, 2, 3];
  const index = rates.indexOf(viralRate);
  return <section className="patient-monitor" aria-label="Estado da pessoa simulada" data-testid="patient-monitor" data-stage={snapshot.body.stage}>
    <div className="patient-main">
      <span className="patient-kicker"><i/>PESSOA SIMULADA <b>·</b> CENÁRIO {snapshot.scenarioId}</span>
      <div className="patient-summary"><h2>{person.title}</h2><p>{person.description}</p></div>
      <small>{person.tissueNote} {person.affectedRegions ? `${person.affectedRegions} ${person.affectedRegions === 1 ? 'região em atividade' : 'regiões em atividade'}.` : ''}</small>
    </div>
    <div className="patient-symptoms" aria-label="Sintomas ilustrativos possíveis"><span>SINTOMAS NESTA ILUSTRAÇÃO</span><div>{person.symptoms.map(symptom => <em key={symptom}>{symptom}</em>)}</div><small>Hipóteses narrativas, não sintomas calculados ou previstos.</small></div>
    <div className="patient-tracking" aria-label="Índices do modelo"><div><span>Atividade viral</span><strong data-testid="body-viral-index">{person.viral}<small>/100</small></strong><i className="patient-track"><i style={{ width: `${person.viral}%` }} /></i></div><div><span>Tecido íntegro</span><strong data-testid="body-tissue-index">{person.integrity}<small>/100</small></strong><i className="patient-track tissue"><i style={{ width: `${person.integrity}%` }} /></i></div></div>
    <div className="patient-viral-control"><span>RITMO VIRAL DO CENÁRIO</span><div><button type="button" aria-label="Diminuir ritmo viral" disabled={index <= 0} onClick={() => onViralRate(rates[Math.max(0, index - 1)]!)}>−</button><strong data-testid="viral-rate">{formatNumber(viralRate,viralRate%1?1:0)}×</strong><button type="button" aria-label="Aumentar ritmo viral" disabled={index >= rates.length - 1 || snapshot.simulatedHour >= snapshot.config.horizonDays * 24} onClick={() => onViralRate(rates[Math.min(rates.length - 1, index + 1)]!)}>＋</button></div><small>Altera contato e replicação no cenário B a partir da próxima hora.</small></div>
  </section>;
}
