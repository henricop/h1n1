import {JourneySimulation} from '../engine/journey/JourneySimulation';
import type {JourneyLogEntry,JourneySnapshot} from './types';
/** Look ahead in an isolated, identical model. Never moves or mutates the live clock. */
export function nextCalculatedMilestone(snapshot:JourneySnapshot):JourneyLogEntry|null {
  const probe=new JourneySimulation(snapshot.config);
  if(snapshot.scenarioId==='B'){for(const event of snapshot.events)probe.upsertEvent(event);probe.setActiveScenario('B');}
  const end=snapshot.config.horizonDays*24;
  for(let hour=Math.min(end,snapshot.simulatedHour+6);hour<=end;hour=Math.min(end,hour+6)){
    probe.seek(hour);
    const next=probe.getSnapshot().log.find(event=>event.simulatedHour>snapshot.simulatedHour);
    if(next)return next;
    if(hour===end)break;
  }
  return null;
}
