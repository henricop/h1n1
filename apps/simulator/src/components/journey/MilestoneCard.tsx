import { useEffect, useRef, useState } from 'react';
import type { JourneyLogEntry, JourneySnapshot } from '../../journey/types';
import { anatomyRegion } from '../../journey/anatomy';
import './milestone-card.css';

function shortExplanation(entry: JourneyLogEntry): string {
  switch (entry.kind) {
    case 'exposure': return 'O primeiro contato foi registrado na mucosa nasal.';
    case 'no-exposure': return 'Este cenário começou sem contato viral.';
    case 'local-infection': return 'As primeiras células desta região passaram ao estado infectado.';
    case 'inflammation-increased': return 'A resposta local elevou o índice de inflamação do tecido.';
    case 'tissue-integrity-decreased': return 'O tecido perdeu integridade nesta região.';
    case 'tissue-repair': return 'Células novas começaram a ocupar posições antes removidas.';
    case 'viral-activity-increased': return 'A atividade viral ultrapassou um novo patamar nesta região.';
    case 'viral-activity-controlled': return 'A atividade viral local caiu abaixo do patamar anterior.';
    case 'event-started': return 'Uma condição do cenário começou a alterar a evolução ilustrada.';
    case 'event-ended': return 'A condição configurada terminou; os efeitos anteriores ainda podem aparecer.';
    default: return entry.kind.startsWith('body-') ? 'O estado geral da pessoa simulada mudou com os índices do modelo.' : entry.explanation;
  }
}

export function MilestoneCard({ snapshot, onOpen }: { snapshot: JourneySnapshot; onOpen: (entry: JourneyLogEntry) => void }) {
  const [queue, setQueue] = useState<JourneyLogEntry[]>([]);
  const [hovered, setHovered] = useState(false);
  const cursor = useRef<{ key: string; hour: number; seen: Set<string> } | null>(null);
  const current = queue[0];
  useEffect(() => {
    const key = `${snapshot.config.seed}:${snapshot.scenarioId}`;
    const old = cursor.current;
    if (!old || old.key !== key || snapshot.simulatedHour < old.hour) {
      cursor.current = { key, hour: snapshot.simulatedHour, seen: new Set(snapshot.log.map(item => item.id)) };
      setQueue(snapshot.simulatedHour <= 1 ? snapshot.log.filter(item => item.simulatedHour === 0).slice(-1) : []);
      return;
    }
    const additions = snapshot.log.filter(item => item.simulatedHour >= old.hour && !old.seen.has(item.id));
    snapshot.log.forEach(item => old.seen.add(item.id));
    const jumped = snapshot.simulatedHour - old.hour > 24;
    old.hour = snapshot.simulatedHour;
    if (additions.length) setQueue(previous => [...previous, ...(jumped ? additions.slice(-1) : additions)].slice(-16));
  }, [snapshot]);
  useEffect(() => {
    if (!current || hovered) return;
    const timeout = window.setTimeout(() => setQueue(previous => previous.slice(1)), 5500);
    return () => window.clearTimeout(timeout);
  }, [current, hovered]);
  if (!current) return null;
  return <aside className="milestone-card" role="status" aria-live="polite" aria-label="Novo marco da simulação" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }} data-testid="milestone-card">
    <div className="milestone-top"><span><i/>ACONTECEU NA SIMULAÇÃO</span><button aria-label="Fechar marco" onClick={() => setQueue(previous => previous.slice(1))}>×</button></div>
    <time>Dia {Math.floor(current.simulatedHour / 24)} · {String(current.simulatedHour % 24).padStart(2, '0')}h · {anatomyRegion(current.regionId).shortName}</time>
    <h2>{current.title}</h2><p>{shortExplanation(current)}</p>
    <button className="milestone-open" onClick={() => { onOpen(current); setQueue(previous => previous.slice(1)); }}>Ver este instante no 3D <span>↗</span></button>
    {queue.length > 1 && <small>{queue.length - 1} {queue.length === 2 ? 'marco seguinte' : 'marcos seguintes'}</small>}
  </aside>;
}
