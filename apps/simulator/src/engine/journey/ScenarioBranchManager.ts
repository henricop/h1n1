import { ANATOMY } from '../../journey/anatomy';
import type { JourneyConfig, JourneyLogEntry, ScenarioEvent } from '../../journey/types';
import { aggregateBody } from './BodyState';
import { ADVERSITIES } from './config';
import { modifiersFor } from './EventModifierSystem';
import type { InternalRegion, InternalWorld, ScenarioBranch } from './internal';
import { createRegions, updateRegion } from './RegionSystem';
import { JourneyRandom } from './SeededRandom';
import { SnapshotManager } from './SnapshotManager';

const clone = <T>(value: T): T => structuredClone(value);
const nameOf = (id: string) => ANATOMY.find(item => item.regionId === id)?.shortName ?? id;
const stageNames = { exposure: 'Contato com a mucosa', local: 'Infecção local', response: 'Resposta de defesa', recovering: 'Reparo em andamento', worsening: 'Maior comprometimento ilustrativo', controlled: 'Atividade controlada' };
function log(world: InternalWorld, entry: JourneyLogEntry): void {
  world.log.push(entry);
  // Retain the initial exposure, and bound all later records.
  if (world.log.length > 256) world.log.splice(1, world.log.length - 256);
}
function history(world: InternalWorld): void {
  const b = world.body;
  world.history.push({ hour: world.hour, viralActivity: b.viralActivity, immuneActivity: b.immuneActivity, inflammation: b.inflammation, tissueIntegrity: b.tissueIntegrity, condition: b.condition });
}
export function initialWorld(config: JourneyConfig, events: ScenarioEvent[]): InternalWorld {
  const random = new JourneyRandom(config.seed);
  const regions = createRegions(config, events, random);
  const body = aggregateBody(regions, null, 0);
  const world: InternalWorld = { hour: 0, randomState: random.state, regions, body, log: [], history: [] };
  const contact = config.initialConditions.exposure > 0;
  log(world, { id: 'initial-contact', simulatedHour: 0, kind: contact ? 'exposure' : 'no-exposure', regionId: 'nasal', relatedFactors: regions[0]!.factors,
    title: contact ? 'Contato inicial na mucosa' : 'Sem contato inicial', explanation: contact ? 'O contato inicial adicionou atividade viral à mucosa nasal neste modelo. As outras regiões começam sem atividade viral; sua evolução dependerá das conexões e da defesa calculada.' : 'Este cenário começou sem contato viral. Nenhuma infecção é introduzida por uma data programada.', level: 'respiratory' });
  history(world);
  return world;
}
export function createBranch(config: JourneyConfig, events: ScenarioEvent[]): ScenarioBranch {
  const state = initialWorld(config, events);
  return { state, snapshots: new SnapshotManager(state) };
}

function relevantRegionLog(world: InternalWorld, previous: InternalRegion[], region: InternalRegion): void {
  const old = previous.find(item => item.regionId === region.regionId)!;
  const hour = world.hour;
  let kind = '', title = '', level: JourneyLogEntry['level'] = 'tissue';
  if (!old.everInfected && region.everInfected) { kind = 'local-infection'; title = `Primeiras células infectadas: ${nameOf(region.regionId)}`; level = 'cell'; }
  else if (Math.floor(region.inflammation / 20) > Math.floor(old.inflammation / 20)) { kind = 'inflammation-increased'; title = `Inflamação aumentou: ${nameOf(region.regionId)}`; }
  else if (Math.floor(region.tissueIntegrity / 10) < Math.floor(old.tissueIntegrity / 10)) { kind = 'tissue-integrity-decreased'; title = `Integridade do tecido diminuiu: ${nameOf(region.regionId)}`; }
  else if (region.repairedCells > old.repairedCells && (!old.repairedCells || Math.floor(region.repairedCells / 8) > Math.floor(old.repairedCells / 8))) { kind = 'tissue-repair'; title = `Reposição celular: ${nameOf(region.regionId)}`; }
  else if (Math.floor(region.viralActivity / 25) > Math.floor(old.viralActivity / 25)) { kind = 'viral-activity-increased'; title = `Atividade viral aumentou: ${nameOf(region.regionId)}`; level = 'organ'; }
  else if (old.viralActivity >= 3 && region.viralActivity < 3) { kind = 'viral-activity-controlled'; title = `Atividade local em queda: ${nameOf(region.regionId)}`; }
  if (kind) log(world, { id: `${kind}-${hour}-${region.regionId}`, simulatedHour: hour, kind, regionId: region.regionId, relatedFactors: [...region.factors], title,
    explanation: `Nesta região, a engine utilizou ${region.factors.length ? region.factors.join('; ') : 'a atividade celular e a defesa basal'}. Os índices são internos à simulação e não representam exames ou previsão individual.`, level });
}

/** Advances the actual state one hour. No stage or effect is attached to a fixed calendar day. */
export function stepWorld(world: InternalWorld, config: JourneyConfig, events: ScenarioEvent[]): void {
  const previous = world.regions.map(region => ({ ...region }));
  const previousBody = world.body;
  const random = new JourneyRandom(world.randomState);
  world.hour++;
  let discomfort = 0;
  for (let index = 0; index < world.regions.length; index++) {
    const region = world.regions[index]!;
    const anatomy = ANATOMY.find(item => item.regionId === region.regionId)!;
    let incoming = 0;
    for (const id of anatomy.connections) {
      const sourceIndex = previous.findIndex(item => item.regionId === id);
      const source = previous[sourceIndex]!;
      // Connected downstream regions receive a fraction of existing activity, never a scheduled seeding.
      incoming += source.viralPool * (sourceIndex < index ? .016 : .002);
    }
    const modifiers = modifiersFor(region.regionId, world.hour, config.initialConditions, events);
    discomfort += modifiers.discomfort / world.regions.length;
    // Consume exactly one world draw per region/hour. Conditional draws inside one
    // tissue must not perturb an unrelated region before activity travels there.
    const regionalRandom = new JourneyRandom((random.next() * 0x100000000) >>> 0);
    updateRegion(region, incoming, world.hour, modifiers, regionalRandom, config.initialConditions);
  }
  world.body = aggregateBody(world.regions, previousBody, world.hour, discomfort);
  world.randomState = random.state;
  for (const event of events) {
    if (!event.enabled) continue;
    const definition = ADVERSITIES.find(item => item.kind === event.kind)!;
    const regionId = event.targetRegionId ?? 'nasal';
    if (world.hour === event.startHour || event.startHour === 0 && world.hour === 1) log(world, {
      id: `event-start-${event.id}`, simulatedHour: world.hour, kind: 'event-started', regionId,
      relatedFactors: [`event:${event.id}`, definition.parameter], title: `Condição ativa: ${definition.title}`,
      explanation: `O evento modifica ${definition.parameter}${event.targetRegionId ? ` em ${nameOf(event.targetRegionId)}` : ' nas regiões do modelo'}. A intensidade ${event.intensity === 'high' ? 'intensa' : event.intensity === 'moderate' ? 'moderada' : 'leve'} controla somente os coeficientes demonstrativos, sem magnitude clínica individual.`, level: 'tissue',
    });
    if (world.hour === event.startHour + event.durationHours) log(world, {
      id: `event-end-${event.id}`, simulatedHour: world.hour, kind: 'event-ended', regionId,
      relatedFactors: [`event:${event.id}`, definition.parameter], title: `Condição encerrada: ${definition.title}`,
      explanation: `A duração configurada terminou. Os modificadores de ${definition.parameter} não estão mais ativos; as alterações de tecido já ocorridas continuam seguindo as regras de reparo.`, level: 'tissue',
    });
  }
  for (const region of world.regions) relevantRegionLog(world, previous, region);
  if (world.body.stage !== previousBody.stage) {
    const affected = [...world.regions].sort((a, b) => (b.viralActivity + b.inflammation + 100 - b.tissueIntegrity) - (a.viralActivity + a.inflammation + 100 - a.tissueIntegrity))[0]!;
    log(world, { id: `body-stage-${world.hour}-${world.body.stage}`, simulatedHour: world.hour, kind: `body-${world.body.stage}`, regionId: affected.regionId,
      relatedFactors: [...affected.factors], title: stageNames[world.body.stage],
      explanation: `A classificação mudou porque os índices calculados de atividade viral, defesa, inflamação e integridade mudaram. Em ${nameOf(affected.regionId)}, os fatores utilizados foram ${affected.factors.join('; ') || 'o estado das células e a defesa basal'}.`, level: world.body.stage === 'exposure' ? 'respiratory' : 'tissue' });
  }
  history(world);
}

export function computeBranch(branch: ScenarioBranch, target: number, config: JourneyConfig, events: ScenarioEvent[], onStep: () => void): InternalWorld {
  if (branch.state.hour === target) return branch.state;
  const cached = branch.snapshots.nearest(target);
  if (branch.state.hour > target || branch.state.hour < cached.hour) branch.state = cached;
  while (branch.state.hour < target) {
    stepWorld(branch.state, config, events); onStep(); branch.snapshots.save(branch.state);
  }
  return branch.state;
}

export function invalidateBranch(branch: ScenarioBranch, affectedHour: number, config: JourneyConfig, events: ScenarioEvent[]): ScenarioBranch {
  if (affectedHour <= 0) return createBranch(config, events);
  branch.snapshots.invalidateFrom(affectedHour);
  if (branch.state.hour >= affectedHour) branch.state = branch.snapshots.nearest(affectedHour - 1);
  return branch;
}

export { clone };
