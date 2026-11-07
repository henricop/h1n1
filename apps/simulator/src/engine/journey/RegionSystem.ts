import type { InitialConditions, JourneyCell, JourneyConfig, RegionId } from '../../journey/types';
import { ANATOMY } from '../../journey/anatomy';
import { clamp } from './config';
import type { InternalRegion } from './internal';
import { JourneyRandom } from './SeededRandom';
import { modifiersFor, type RegionModifiers } from './EventModifierSystem';
import type { ScenarioEvent } from '../../journey/types';

export function createRegions(config: JourneyConfig, events: ScenarioEvent[], random: JourneyRandom): InternalRegion[] {
  return ANATOMY.map(({ regionId }) => {
    const width = Math.ceil(Math.sqrt(config.cellsPerRegion));
    const rows = Math.ceil(config.cellsPerRegion / width);
    const cells: JourneyCell[] = Array.from({ length: config.cellsPerRegion }, (_, slot) => ({
      id: `${regionId}:${slot}:0`, slot, generation: 0, status: 'healthy', sinceHour: 0, age: 0,
      position: { x: ((slot % width) - (width - 1) / 2 + (Math.floor(slot / width) % 2 ? .25 : -.25)), y: (random.next() - .5) * .07, z: (Math.floor(slot / width) - (rows - 1) / 2) * .93 },
      infectionAge: 0, damage: 0,
    }));
    const m = modifiersFor(regionId, 0, config.initialConditions, events);
    const region: InternalRegion = { regionId, cells, viralActivity: 0, viralPool: 0, immuneMemory: m.protection * .22,
      immuneActivity: m.defense * 8 + m.protection * 8, inflammation: 0, tissueIntegrity: 100 - m.vulnerability * 4,
      healthyCellRatio: 1, exposedCellRatio: 0, infectedCellRatio: 0, damagedCellRatio: 0, recoveringCellRatio: 0,
      representativeViruses: 0, representativeDefenders: Math.round((m.defense * 8 + m.protection * 8) / 4), repairedCells: 0, factors: [...m.factors], everInfected: 0 };
    if (regionId === 'nasal' && config.initialConditions.exposure > 0) {
      region.viralPool = config.initialConditions.exposure * 28 * (1 - .65 * m.protection);
      const exposed = Math.max(1, Math.round((2 + config.initialConditions.exposure * 2) * (1 - .6 * m.protection)));
      const offset = Math.floor(random.next() * cells.length);
      for (let i = 0; i < exposed; i++) cells[(offset + i * 11) % cells.length]!.status = 'exposed';
      region.factors.push('contato inicial com a mucosa');
    }
    summarize(region);
    return region;
  });
}

function summarize(region: InternalRegion): void {
  const n = region.cells.length;
  let healthy = 0, exposed = 0, infected = 0, damaged = 0, recovering = 0;
  for (const cell of region.cells) {
    switch (cell.status) {
      case 'healthy': case 'controlled': healthy++; break;
      case 'exposed': exposed++; break;
      case 'infected': infected++; break;
      case 'damaged': case 'removed': damaged++; break;
      case 'recovering': recovering++; break;
    }
  }
  region.healthyCellRatio = healthy / n; region.exposedCellRatio = exposed / n; region.infectedCellRatio = infected / n;
  region.damagedCellRatio = damaged / n; region.recoveringCellRatio = recovering / n;
  region.viralActivity = clamp(region.viralPool, 0, 100);
  region.representativeViruses = region.viralPool < .08 ? 0 : Math.round(clamp(region.viralPool * 1.2, 1, 120));
  region.representativeDefenders = Math.round(clamp(region.immuneActivity / 4, 0, 24));
}

const transition = (cell: JourneyCell, status: JourneyCell['status'], hour: number) => { cell.status = status; cell.sinceHour = hour; };

/** Cell-derived activity drives tissue indices. Incoming activity is read from the previous complete hour. */
export function updateRegion(region: InternalRegion, incoming: number, hour: number, m: RegionModifiers, random: JourneyRandom, initial: InitialConditions): void {
  const previousPool = region.viralPool;
  const viableSusceptibility = (1 - m.protection * .72) * (1 - region.immuneMemory * .91) * (1 - region.immuneActivity / 155);
  const pressure = clamp((previousPool * .00055 + incoming * .001) * m.viralRate * viableSusceptibility / m.barrier, 0, .25);
  let matureInfected = 0;
  for (let index = 0; index < region.cells.length; index++) {
    const cell = region.cells[index]!;
    cell.age++;
    const age = hour - cell.sinceHour;
    if (cell.status === 'healthy') {
      if (random.next() < pressure) transition(cell, 'exposed', hour);
      else if (m.irritation > 0 && random.next() < m.irritation * .0025) { transition(cell, 'damaged', hour); cell.damage = 1; }
    } else if (cell.status === 'exposed') {
      if (random.next() < .002 + region.immuneActivity * .00045 + m.protection * .015) transition(cell, 'controlled', hour);
      else if (age >= 8 && random.next() < .18) { transition(cell, 'infected', hour); cell.infectionAge = 0; region.everInfected++; }
    } else if (cell.status === 'infected') {
      cell.infectionAge++;
      if (cell.infectionAge >= 4) matureInfected++;
      cell.damage = clamp(cell.damage + .006 + (m.vulnerability + m.irritation) * .009 + region.inflammation * .00008);
      const control = .008 + region.immuneActivity * .0011 + region.immuneMemory * .022 + m.protection * .015;
      if (random.next() < control) { transition(cell, 'controlled', hour); cell.infectionAge = 0; cell.damage *= .3; }
      else if (cell.infectionAge >= 14 && random.next() < .009 + cell.damage * .025 + m.vulnerability * .018 + m.irritation * .035) { transition(cell, 'damaged', hour); cell.damage = 1; }
    } else if (cell.status === 'damaged') {
      if (age >= 8) transition(cell, 'removed', hour);
    } else if (cell.status === 'removed') {
      if (age >= 8 && random.next() < (.035 + m.resilience * .065) * m.repair) {
        // A repaired slot contains a NEW cell, not the damaged cell resurrected.
        const generation = cell.generation + 1;
        region.cells[index] = { ...cell, id: `${region.regionId}:${cell.slot}:${generation}`, generation, status: 'recovering', sinceHour: hour, age: 0, infectionAge: 0, damage: 0, position: { ...cell.position } };
        region.repairedCells++;
      }
    } else if (cell.status === 'recovering') {
      if (age >= 12 && random.next() < .1 * m.repair + m.resilience * .06) transition(cell, 'healthy', hour);
    } else if (cell.status === 'controlled') {
      cell.damage = Math.max(0, cell.damage - .035 * m.repair);
      if (age >= 12) transition(cell, 'healthy', hour);
    }
  }
  summarize(region);
  const antigen = region.exposedCellRatio * .011 + region.infectedCellRatio * .022 + previousPool * .000055;
  region.immuneMemory = clamp(region.immuneMemory + antigen * (.3 + m.defense) * (1 - region.immuneMemory));
  const immuneTarget = m.defense * 8 + m.protection * 12 + (region.immuneMemory * 78 + region.infectedCellRatio * 36 + previousPool * .12) * (.22 + m.defense * .95);
  region.immuneActivity = clamp(region.immuneActivity + (immuneTarget - region.immuneActivity) * .12, 0, 100);
  const reproduction = matureInfected / region.cells.length * 18 * m.viralRate * (1 - m.protection * .3);
  const clearance = .024 + region.immuneActivity * .0011 + region.immuneMemory * .045 + m.protection * .055;
  region.viralPool = clamp(previousPool * (1 - clearance) + reproduction + incoming, 0, 100);
  if (region.viralPool < .08 && !region.infectedCellRatio && !region.exposedCellRatio) region.viralPool = 0;
  const inflammationTarget = region.infectedCellRatio * 88 + region.damagedCellRatio * 48 + region.viralPool * .16 + m.irritation * 48;
  region.inflammation = clamp(region.inflammation + (inflammationTarget - region.inflammation) * .1, 0, 100);
  const loss = region.damagedCellRatio * 75 + region.recoveringCellRatio * 24 + region.infectedCellRatio * 12 + region.inflammation * .19 + m.irritation * 26 + m.vulnerability * 4;
  const integrityTarget = clamp(100 - loss, 0, 100);
  region.tissueIntegrity = clamp(region.tissueIntegrity + (integrityTarget - region.tissueIntegrity) * .085 * m.repair, 0, 100);
  region.factors = [...m.factors];
  if (matureInfected) region.factors.push('replicação de células infectadas');
  if (incoming > .02) region.factors.push('atividade recebida de uma região conectada');
  if (region.immuneActivity > 12) region.factors.push('controle pela resposta de defesa local');
  if (region.inflammation > 5) region.factors.push('inflamação local altera a integridade');
  if (region.damagedCellRatio > 0) region.factors.push('células danificadas ou removidas reduzem a barreira');
  if (region.repairedCells > 0) region.factors.push('reparo com reposição de células');
  if (initial.exposure === 0 && !region.viralPool) region.factors.push('ausência de contato viral inicial');
  summarize(region);
}
