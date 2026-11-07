import { useEffect, useRef, useState } from 'react';
import { anatomyRegion } from '../../journey/anatomy';
import type { JourneyLogEntry, JourneySnapshot } from '../../journey/types';
import { localized } from '../../i18n';
import { formatJourneyHour } from './TimelineControls';
import './milestone-roadmap.css';

export function roadmapScenarioKey(snapshot: JourneySnapshot): string {
  return JSON.stringify([snapshot.scenarioId, snapshot.config, snapshot.events]);
}

export function mergeReachedMilestones(previous: JourneyLogEntry[], current: JourneyLogEntry[]): JourneyLogEntry[] {
  if (current.every((entry) => previous.some((seen) => seen.id === entry.id))) return previous;
  const byId = new Map(previous.map((entry) => [entry.id, entry]));
  current.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()].sort((a, b) => a.simulatedHour - b.simulatedHour);
}

interface MilestoneRoadmapProps {
  snapshot: JourneySnapshot;
  onOpen: (entry: JourneyLogEntry) => void;
  onNext: () => void;
}

export function MilestoneRoadmap({ snapshot, onOpen, onNext }: MilestoneRoadmapProps) {
  const key = roadmapScenarioKey(snapshot);
  const [reachedByScenario, setReachedByScenario] = useState<Record<string, JourneyLogEntry[]>>({});
  const track = useRef<HTMLOListElement>(null);
  const previousLastId = useRef<string | null>(null);
  const reached = mergeReachedMilestones(reachedByScenario[key] ?? [], snapshot.log);
  const latestId = reached.at(-1)?.id ?? null;
  let currentIndex = -1;
  reached.forEach((entry, index) => { if (entry.simulatedHour <= snapshot.simulatedHour) currentIndex = index; });

  useEffect(() => {
    setReachedByScenario((previous) => {
      const merged = mergeReachedMilestones(previous[key] ?? [], snapshot.log);
      return merged === previous[key] ? previous : { ...previous, [key]: merged };
    });
  }, [key, snapshot.log]);

  useEffect(() => {
    if (latestId && latestId !== previousLastId.current && track.current) {
      track.current.scrollLeft = track.current.scrollWidth;
    }
    previousLastId.current = latestId;
  }, [latestId]);

  return <section className="milestone-roadmap" id="milestone-roadmap" aria-label={localized('Milestone roadmap', 'Roteiro de marcos')} data-testid="milestone-roadmap">
    <div className="milestone-roadmap-heading">
      <div><span className="milestone-roadmap-kicker">{localized('THE JOURNEY SO FAR', 'A JORNADA ATÉ AQUI')}</span><p>{localized('Choose a card to revisit that moment in 3D.', 'Escolha um card para voltar àquele instante no 3D.')}</p></div>
      <div className="milestone-roadmap-actions">
        <span>{reached.length} {reached.length === 1 ? localized('milestone', 'marco') : localized('milestones', 'marcos')}</span>
        <button type="button" onClick={() => { if (track.current) track.current.scrollLeft -= 240; }} aria-label={localized('Earlier milestone cards', 'Cards de marcos anteriores')}>‹</button>
        <button type="button" onClick={() => { if (track.current) track.current.scrollLeft += 240; }} aria-label={localized('Later milestone cards', 'Cards de marcos seguintes')}>›</button>
        <button type="button" className="milestone-roadmap-next" onClick={onNext}>{localized('Next milestone', 'Próximo marco')} <span aria-hidden="true">→</span></button>
      </div>
    </div>
    <ol className="milestone-roadmap-track" ref={track}>
      {reached.map((entry, index) => <li key={entry.id} className={index === currentIndex ? 'is-current' : entry.simulatedHour > snapshot.simulatedHour ? 'is-ahead' : ''}>
        <button type="button" onClick={() => onOpen(entry)} aria-label={`${localized('Revisit milestone', 'Rever marco')}: ${entry.title}, ${formatJourneyHour(entry.simulatedHour)}, ${anatomyRegion(entry.regionId).shortName}`} aria-current={index === currentIndex ? 'step' : undefined}>
          <span className="milestone-roadmap-step">{String(index + 1).padStart(2, '0')}</span>
          <span className="milestone-roadmap-content"><time>{formatJourneyHour(entry.simulatedHour)}</time><strong>{entry.title}</strong><small>{anatomyRegion(entry.regionId).shortName}</small></span>
          <span className="milestone-roadmap-arrow" aria-hidden="true">↗</span>
        </button>
      </li>)}
    </ol>
  </section>;
}
