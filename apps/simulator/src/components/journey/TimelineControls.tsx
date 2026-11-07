import type { JourneyLogEntry, ScenarioEvent } from '../../journey/types';
import { formatNumber, localized } from '../../i18n';
import './journey-panels.css';

export interface TimelineControlsProps {
  compact?: boolean;
  hour: number;
  horizonDays: 14 | 21;
  playing: boolean;
  speed: number;
  log: JourneyLogEntry[];
  events: ScenarioEvent[];
  onSeek: (hour: number) => void;
  onStep: (hours: number) => void;
  onToggle: () => void;
  onSpeed: (value: number) => void;
  onReplay: () => void;
  onHorizon: (days: 14 | 21) => void;
  onShowEvent: (entry: JourneyLogEntry) => void;
}

export function formatJourneyHour(hour: number): string {
  const safe = Math.max(0, Math.floor(hour));
  return `Dia ${Math.floor(safe / 24)} · ${String(safe % 24).padStart(2, '0')}h`;
}

const eventKindNames: Record<ScenarioEvent['kind'], string> = {
  sleep: 'Privação de sono', stress: 'Estresse', smoke: 'Exposição à fumaça', dehydration: 'Hidratação insuficiente',
  'reduced-defense': 'Defesa reduzida', 'respiratory-vulnerability': 'Vulnerabilidade respiratória',
  'prior-protection': 'Proteção prévia', rest: 'Suporte e repouso', 'viral-rate': 'Ritmo viral',
};

export function TimelineControls({ compact = false, hour, horizonDays, playing, speed, log, events, onSeek, onStep, onToggle, onSpeed, onReplay, onHorizon, onShowEvent }: TimelineControlsProps) {
  const totalHours = horizonDays * 24;
  const position = (at: number) => `${Math.max(0, Math.min(100, at / totalHours * 100))}%`;
  // Keep one explicit preview; the full event history is available in the Events panel.
  const latest = [...log].filter((entry) => entry.simulatedHour <= hour).sort((a, b) => b.simulatedHour - a.simulatedHour).slice(0, 1);
  const milestones = [...new Map(log.filter((entry) => entry.simulatedHour <= totalHours).map((entry) => [entry.simulatedHour, entry])).values()].slice(-16);
  const ticks = compact ? [0, 3, 7, 14, ...(horizonDays === 21 ? [21] : [])] : Array.from({ length: horizonDays + 1 }, (_, day) => day);
  return <section className={`journey-timeline ${compact ? 'is-compact' : ''}`} aria-label="Tempo e reprodução">
    <div className="journey-transport">
      <div className="journey-time-heading">{!compact && <span className="journey-eyebrow">Tempo simulado</span>}<strong data-testid="timeline-hour">{formatJourneyHour(hour)}</strong>{!compact && <span>de {horizonDays} dias</span>}</div>
      <div className="journey-transport-buttons">
        <button type="button" className="journey-small-button" aria-label="Voltar um dia" title="Voltar um dia" disabled={hour <= 0} onClick={() => onStep(-24)}>{compact ? '− dia' : '−1 dia'}</button>
        <button type="button" className="journey-play-button" aria-label={playing ? 'Pausar' : hour === 0 ? 'Iniciar jornada' : 'Continuar'} onClick={onToggle}>{playing ? 'Pausar' : hour === 0 ? compact ? 'Iniciar' : 'Iniciar jornada' : 'Continuar'}</button>
        {!compact && <button type="button" className="journey-small-button" disabled={hour >= totalHours} aria-label="Avançar uma hora" onClick={() => onStep(1)}>+1 hora</button>}
        <button type="button" className="journey-small-button" disabled={hour >= totalHours} aria-label="Avançar um dia" onClick={() => onStep(24)}>{compact ? '+ dia' : '+1 dia'}</button>
        {!compact && <button type="button" className="journey-text-button" onClick={onReplay}>Replay</button>}
      </div>
      <div className="journey-time-options">
        <label><span className={compact ? 'journey-sr-only' : undefined}>Velocidade</span><select aria-label="Velocidade" value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>{[.5, 1, 2, 5].map((value) => <option key={value} value={value}>{formatNumber(value,value%1?1:0)}×</option>)}</select></label>
        {!compact && <label><span>Horizonte</span><select aria-label="Horizonte da simulação" value={horizonDays} onChange={(e) => onHorizon(Number(e.target.value) as 14 | 21)}><option value={14}>14 dias</option><option value={21}>21 dias</option></select></label>}
        {compact && <details className="journey-timeline-more"><summary aria-label="Mais controles de tempo" title="Mais controles de tempo">•••</summary><div><button type="button" className="journey-small-button" disabled={hour >= totalHours} aria-label="Avançar uma hora" onClick={() => onStep(1)}>Avançar uma hora</button><button type="button" className="journey-small-button" onClick={onReplay}>Replay</button><label>Horizonte<select aria-label="Horizonte da simulação" value={horizonDays} onChange={(e) => onHorizon(Number(e.target.value) as 14 | 21)}><option value={14}>14 dias</option><option value={21}>21 dias</option></select></label></div></details>}
      </div>
    </div>
    <div className="journey-scrubber">
      <label className="journey-sr-only" htmlFor="journey-time-range">Linha do tempo</label>
      <input id="journey-time-range" type="range" aria-label="Linha do tempo" min={0} max={totalHours} step={1} value={Math.max(0, Math.min(totalHours, hour))} aria-valuetext={formatJourneyHour(hour)} onChange={(e) => onSeek(e.currentTarget.valueAsNumber)} />
      <div className="journey-time-ticks" aria-hidden="true">{ticks.map((day) => <span key={day} style={{ left: `${day / horizonDays * 100}%` }}>{day === 0 || day === horizonDays ? `Dia ${day}` : day}</span>)}</div>
      <div className="journey-time-markers" aria-label="Eventos na linha do tempo">
        {events.map((event) => {
          const active = event.enabled && hour >= event.startHour && hour < event.startHour + event.durationHours;
          return <button key={event.id} type="button" className={`journey-event-marker ${active ? 'is-active' : ''} ${!event.enabled ? 'is-disabled' : ''}`} style={{ left: position(event.startHour) }} aria-label={`${eventKindNames[event.kind]}, ${formatJourneyHour(event.startHour)}${!event.enabled ? localized(', disabled', ', desativado') : active ? localized(', active', ', ativo') : ''}`} title={`${eventKindNames[event.kind]} · ${formatJourneyHour(event.startHour)}`} onClick={() => onSeek(event.startHour)}><span aria-hidden="true">◆</span></button>;
        })}
        {milestones.map((entry) => <button type="button" key={entry.id} className="journey-milestone-marker" style={{ left: position(entry.simulatedHour) }} aria-label={`Mostrar o que aconteceu: ${entry.title}, ${formatJourneyHour(entry.simulatedHour)}`} title={`${entry.title} · ${formatJourneyHour(entry.simulatedHour)}`} onClick={() => onShowEvent(entry)}><span aria-hidden="true">●</span></button>)}
      </div>
    </div>
    {!compact && <div className="journey-timeline-caption"><span><i className="journey-log-key" /> Marcos calculados pela simulação</span><span><i className="journey-event-key" /> Eventos do cenário</span><span>Arraste para revisar; o estado é reconstruído pela mesma seed.</span></div>}
    {!compact && latest.length > 0 && <ol className="journey-recent-log" aria-label="Marcos recentes">{latest.map((entry) => <li key={entry.id}><time>{formatJourneyHour(entry.simulatedHour)}</time><span>{entry.title}</span><button type="button" className="journey-text-button" onClick={() => onShowEvent(entry)} aria-label={`Mostrar o que aconteceu: ${entry.title}`}>Mostrar o que aconteceu <span aria-hidden="true">↗</span></button></li>)}</ol>}
  </section>;
}
