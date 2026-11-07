import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AdversityDefinition, AdversityKind, RegionId, ScenarioEvent } from '../../journey/types';
import { ANATOMY } from '../../journey/anatomy';
import { formatJourneyHour } from './TimelineControls';
import { localized } from '../../i18n';
import './journey-panels.css';

export interface AdversityEditorProps {
  open: boolean; onClose: () => void; events: ScenarioEvent[]; definitions: AdversityDefinition[]; hour: number; horizonDays: 14 | 21;
  onApply: (event: ScenarioEvent) => void; onRemove: (id: string) => void; onToggle: (id: string, enabled: boolean) => void;
}
let editorEventSerial = 0;
const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : min));

export function AdversityEditor({ open, onClose, events, definitions, hour, horizonDays, onApply, onRemove, onToggle }: AdversityEditorProps) {
  const [kind, setKind] = useState<AdversityKind>('sleep');
  const [day, setDay] = useState(Math.floor(hour / 24));
  const [startHour, setStartHour] = useState(hour % 24);
  const [duration, setDuration] = useState(48);
  const [intensity, setIntensity] = useState<ScenarioEvent['intensity']>('moderate');
  const [region, setRegion] = useState<RegionId | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const definition = definitions.find((item) => item.kind === kind) ?? definitions[0];
  const atCapacity = !editingId && events.length >= 40;
  useEffect(() => {
    if (open) {
      setEditingId(null); setDay(Math.floor(hour / 24)); setStartHour(hour % 24); setMessage('');
    }
    // Opening creates a draft at the selected cursor; a running clock must not overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;

  const selectKind = (nextKind: AdversityKind) => {
    setKind(nextKind);
    const next = definitions.find((item) => item.kind === nextKind);
    setDuration(next?.defaultDuration ?? 48);
    if (next?.initialOnly) { setDay(0); setStartHour(0); }
    if (!next?.regional) setRegion('');
  };
  const edit = (event: ScenarioEvent) => {
    setEditingId(event.id); setKind(event.kind); setDay(Math.floor(event.startHour / 24));
    setStartHour(event.startHour % 24); setDuration(event.durationHours); setIntensity(event.intensity); setRegion(event.targetRegionId ?? ''); setMessage('');
  };
  const apply = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!definition) return;
    if (atCapacity) { setMessage('Limite de 40 eventos no cenário. Edite ou remova um evento para continuar.'); return; }
    const when = definition.initialOnly ? 0 : bounded(day * 24 + startHour, 0, horizonDays * 24);
    const existing = events.find((event) => event.id === editingId);
    onApply({ id: editingId ?? `journey-event-${Date.now()}-${++editorEventSerial}`, kind: definition.kind,
      startHour: when, durationHours: bounded(duration, 1, 21 * 24), intensity,
      ...(definition.regional && region ? { targetRegionId: region } : {}), enabled: existing?.enabled ?? true });
    setMessage(localized(`${editingId ? 'Event updated' : 'Event applied'} to scenario B. ${formatJourneyHour(when)}. Compare trajectories to see the change.`, `${editingId ? 'Evento atualizado' : 'Evento aplicado'} no cenário B. ${formatJourneyHour(when)}. Compare as trajetórias para observar a mudança.`));
    setEditingId(null);
  };
  const clearDraft = () => { setEditingId(null); setMessage(''); setDay(Math.floor(hour / 24)); setStartHour(hour % 24); };

  return <section className="journey-panel journey-adversity-editor" id="adversity-editor" aria-labelledby="adversity-editor-title" data-testid="adversity-editor">
    <header className="journey-panel-heading"><div><h2 id="adversity-editor-title">{editingId ? 'Editar evento' : 'E se alguma coisa mudar?'}</h2><p>Escolha uma condição e veja seu efeito no cenário B.</p></div><button type="button" className="journey-small-button" onClick={onClose} aria-label="Fechar editor de adversidades">Fechar ×</button></header>
    <div className="journey-event-editor-grid">
      <form className="journey-event-form" onSubmit={apply}>
        <label className="journey-form-wide">Tipo de evento<select aria-label="Tipo de evento" value={definition?.kind ?? kind} onChange={(e) => selectKind(e.target.value as AdversityKind)}>{definitions.map((item) => <option key={item.kind} value={item.kind}>{item.title}</option>)}</select></label>
        <div className="journey-parameter-note journey-form-wide"><strong>{definition?.description ?? 'Escolha uma condição para configurar o evento.'}</strong><details><summary>Como esta condição atua?</summary><p>Parâmetro do modelo: {definition?.parameter ?? '—'}.</p>{definition?.initialOnly && <p>Condição inicial: aplicada antes da exposição, no dia 0. Não representa uma intervenção durante a infecção.</p>}</details></div>
        <label>Dia de início<input aria-label="Dia de início" type="number" min={0} max={horizonDays} value={definition?.initialOnly ? 0 : day} disabled={definition?.initialOnly} onChange={(e) => setDay(bounded(e.currentTarget.valueAsNumber, 0, horizonDays))} required /></label>
        <label>Hora de início<input aria-label="Hora de início" type="number" min={0} max={23} value={definition?.initialOnly ? 0 : startHour} disabled={definition?.initialOnly} onChange={(e) => setStartHour(bounded(e.currentTarget.valueAsNumber, 0, 23))} required /></label>
        <label>Duração em horas<input aria-label="Duração em horas" type="number" min={1} max={21 * 24} value={duration} onChange={(e) => setDuration(bounded(e.currentTarget.valueAsNumber, 1, 21 * 24))} required /></label>
        <label>Intensidade<select aria-label="Intensidade" value={intensity} onChange={(e) => setIntensity(e.target.value as ScenarioEvent['intensity'])}><option value="mild">Leve</option><option value="moderate">Moderada</option><option value="high">Intensa</option></select></label>
        {definition?.regional && <label className="journey-form-wide">Região afetada<select aria-label="Região afetada" value={region} onChange={(e) => setRegion(e.target.value as RegionId | '')}><option value="">Todo o sistema respiratório</option>{ANATOMY.map((entry) => <option key={entry.regionId} value={entry.regionId}>{entry.name}</option>)}</select></label>}
        <p className="journey-form-wide journey-qualitative-note">Uma experiência educativa, sem previsão individual.</p>
        <div className="journey-form-wide journey-form-actions"><button type="submit" className="journey-play-button" disabled={!definition || atCapacity}>Aplicar ao cenário</button>{editingId && <button type="button" className="journey-text-button" onClick={clearDraft}>Cancelar edição</button>}</div>
        {atCapacity && <p className="journey-form-wide journey-qualitative-note">Limite de 40 eventos no cenário. Edite ou remova um evento para continuar.</p>}
        {message && <p className="journey-form-wide journey-form-status" role="status">{message}</p>}
      </form>
      <section className="journey-scheduled-events" aria-label="Eventos do cenário B"><h3>Eventos do cenário B <span>{events.length}</span></h3>{events.length === 0 ? <p className="journey-empty-note">Nenhum evento adicional. A e B compartilham a mesma seed e as mesmas condições iniciais.</p> : <ul>{[...events].sort((a, b) => a.startHour - b.startHour).map((event) => {
        const item = definitions.find((entry) => entry.kind === event.kind);
        const phase = !event.enabled ? 'disabled' : hour < event.startHour ? 'scheduled' : hour >= event.startHour + event.durationHours ? 'completed' : 'active';
        const phaseLabel = phase === 'disabled' ? localized('Disabled', 'Desativado') : phase === 'scheduled' ? localized('Scheduled', 'Agendado') : phase === 'completed' ? localized('Completed', 'Concluído') : localized('In progress', 'Em curso');
        const intensityLabel = event.intensity === 'mild' ? localized('mild', 'leve') : event.intensity === 'high' ? localized('high', 'intensa') : localized('moderate', 'moderada');
        return <li key={event.id} className={!event.enabled ? 'is-disabled' : undefined} data-testid={`scheduled-${event.id}`}><div className="journey-event-item-heading"><strong>{item?.title ?? event.kind}</strong><span className={`journey-phase ${phase === 'active' ? 'is-active' : ''}`}>{phaseLabel}</span></div><p>{formatJourneyHour(event.startHour)} · {event.durationHours} {localized('hours', 'horas')} · {intensityLabel}{event.targetRegionId ? ` · ${ANATOMY.find((entry) => entry.regionId === event.targetRegionId)?.shortName}` : ''}</p><div className="journey-event-item-actions"><button type="button" className="journey-text-button" onClick={() => edit(event)} aria-label={`Editar ${item?.title ?? event.kind}`}>Editar</button><label><input type="checkbox" checked={event.enabled} onChange={(e) => onToggle(event.id, e.currentTarget.checked)} aria-label={`Ativar ${item?.title ?? event.kind}`} />Ativo</label><button type="button" className="journey-text-button journey-danger-button" onClick={() => onRemove(event.id)} aria-label={`Remover ${item?.title ?? event.kind}`}>Remover</button></div></li>;
      })}</ul>}</section>
    </div>
  </section>;
}
