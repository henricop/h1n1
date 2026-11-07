import type { InitialConditions, RegionId, ScenarioEvent } from '../../journey/types';
import { ADVERSITIES, clamp } from './config';
export interface RegionModifiers {
  defense: number; repair: number; resilience: number; protection: number; vulnerability: number; irritation: number; barrier: number; discomfort: number; viralRate: number; factors: string[];
}
export const activeAt = (event: ScenarioEvent, hour: number) => event.enabled && hour >= event.startHour && hour < event.startHour + event.durationHours;
const intensity = { mild: .4, moderate: .7, high: 1 };
export function modifiersFor(region: RegionId, hour: number, initial: InitialConditions, events: ScenarioEvent[]): RegionModifiers {
  const m: RegionModifiers = { defense: initial.defense, repair: 1, resilience: initial.resilience, protection: initial.protection, vulnerability: initial.vulnerability, irritation: 0, barrier: 1, discomfort: 0, viralRate: 1, factors: [] };
  if (initial.protection > .2) m.factors.push('proteção prévia do cenário');
  if (initial.defense < .4) m.factors.push('defesa basal reduzida');
  if (initial.vulnerability > .25) m.factors.push('vulnerabilidade respiratória inicial');
  for (const e of events) {
    if (!activeAt(e, hour) || e.targetRegionId && e.targetRegionId !== region) continue;
    const strength = intensity[e.intensity];
    switch (e.kind) {
      case 'sleep': m.defense *= 1 - .38 * strength; m.repair *= 1 - .38 * strength; break;
      case 'stress': m.resilience *= 1 - .42 * strength; m.defense *= 1 - .25 * strength; break;
      case 'smoke': m.irritation += .5 * strength; m.barrier *= 1 - .45 * strength; break;
      case 'dehydration': m.repair *= 1 - .42 * strength; m.discomfort += .25 * strength; break;
      case 'reduced-defense': m.defense *= 1 - .65 * strength; break;
      case 'respiratory-vulnerability': m.vulnerability += .5 * strength; m.resilience *= 1 - .35 * strength; break;
      case 'prior-protection': m.protection += .65 * strength; break;
      case 'rest': m.repair *= 1 + .65 * strength; m.resilience += .18 * strength; m.defense += .12 * strength; break;
      case 'viral-rate': m.viralRate = Math.max(m.viralRate, e.intensity === 'mild' ? 1.5 : e.intensity === 'moderate' ? 2 : 3); break;
    }
    const definition = ADVERSITIES.find(item => item.kind === e.kind)!;
    m.factors.push(`${definition.title}: ${definition.parameter} (evento ${e.id})`);
  }
  m.defense = clamp(m.defense); m.resilience = clamp(m.resilience); m.protection = clamp(m.protection); m.vulnerability = clamp(m.vulnerability);
  m.irritation = clamp(m.irritation); m.barrier = clamp(m.barrier, .2, 1); m.repair = clamp(m.repair, .15, 2.5); m.discomfort = clamp(m.discomfort);
  return m;
}
