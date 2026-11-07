import { normalizeConfig } from './config';
import type { Cell, ImmuneCell, SimulationConfig, SimulationEvent, SimulationMetrics, SimulationModel, SimulationSnapshot, SimulationStatus, Vec3, Virus } from './types';

export const FIXED_STEP = 1 / 60;
const VIRUS_LIFETIME = 65;
const REMOVAL_TIME = 0.7;
const EVENT_LIMIT = 30;
const distanceSquared = (a: Vec3, b: Vec3) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const cloneVec = (v: Vec3): Vec3 => ({ ...v });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Mulberry32: all behavior randomness lives here, independent of frame rate and rendering. */
export class SeededRandom {
  constructor(private state: number) {}
  next(): number {
    let n = this.state = (this.state + 0x6D2B79F5) | 0;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  }
  signed(): number { return this.next() * 2 - 1; }
}

/** Mutable fixed-step model. Renderer reads arrays; React receives cloned snapshots at a lower frequency. */
export class Simulation implements SimulationModel {
  readonly cells: Cell[] = [];
  readonly viruses: Virus[] = [];
  readonly immuneCells: ImmuneCell[] = [];
  readonly events: SimulationEvent[] = [];
  config: SimulationConfig;
  private rng = new SeededRandom(0);
  private stepCount = 0;
  private accumulator = 0;
  private speed = 1;
  private runStatus: SimulationStatus = 'running';
  private nextId = 1;
  private nextEventId = 1;
  private neutralizedCount = 0;
  private infectionCount = 0;
  private replicationCount = 0;
  private peak = 0;
  private reason: SimulationMetrics['finishReason'] = null;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = normalizeConfig(config);
    this.reset();
  }

  get time(): number { return this.stepCount * FIXED_STEP; }
  get status(): SimulationStatus { return this.runStatus; }

  /** Reset restarts the same configuration, seed and speed=1. Pass a partial config to change the experiment. */
  reset(config: Partial<SimulationConfig> = {}): void {
    this.config = normalizeConfig(config, this.config);
    this.rng = new SeededRandom(this.config.seed);
    this.cells.length = this.viruses.length = this.immuneCells.length = this.events.length = 0;
    this.stepCount = this.accumulator = this.neutralizedCount = this.infectionCount = this.replicationCount = this.peak = 0;
    this.nextId = this.nextEventId = 1;
    this.speed = 1;
    this.reason = null;
    this.runStatus = 'running';
    this.createCells();
    for (let i = 0; i < this.config.initialViruses; i++) this.spawnVirus();
    for (let i = 0; i < this.config.immuneCount; i++) this.immuneCells.push(this.createImmuneCell());
  }

  play(): void { if (this.runStatus !== 'complete') this.runStatus = 'running'; }
  pause(): void { if (this.runStatus === 'running') this.runStatus = 'paused'; }
  setSpeed(speed: number): void { if (Number.isFinite(speed)) this.speed = clamp(speed, 0.1, 5); }

  setDefense(value: number): void {
    if (!Number.isFinite(value)) return;
    this.config.defense = clamp(value, 0, 10);
    const count = Math.round(this.config.defense * 1.5);
    this.config.immuneCount = count;
    while (this.immuneCells.length < count) this.immuneCells.push(this.createImmuneCell());
    this.immuneCells.length = count;
  }

  addViruses(count: number): void {
    if (!Number.isFinite(count)) return;
    const room = Math.max(0, this.config.maxViruses - this.activeVirusCount());
    const actual = Math.min(room, Math.max(0, Math.floor(count)));
    if (!actual) return;
    this.removeExpiredViruses(true);
    for (let i = 0; i < actual; i++) this.spawnVirus();
    this.emit('seed', this.viruses[this.viruses.length - 1]!.position, `${actual} partículas adicionadas ao ambiente.`);
    // Adding particles is a new intervention; a completed run receives a fresh observation window.
    if (this.runStatus === 'complete') {
      if (this.reason === 'time') this.config.duration = this.time + 180;
      this.reason = null;
      this.runStatus = 'running';
    }
  }

  advance(realSeconds: number): void {
    if (this.runStatus !== 'running' || !Number.isFinite(realSeconds) || realSeconds <= 0) return;
    // No elapsed-time clamping: equal elapsed input produces equal results for any frame partition.
    // The host should skip advance while hidden, instead of simulating a background-tab backlog.
    this.accumulator += realSeconds * this.speed;
    while (this.accumulator + 1e-10 >= FIXED_STEP && this.runStatus === 'running') {
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
      this.step();
    }
  }

  getSnapshot(): SimulationSnapshot {
    let healthy = 0, infected = 0, recovered = 0, attachedViruses = 0;
    for (const cell of this.cells) { if (cell.state === 'healthy') healthy++; else if (cell.state === 'infected') infected++; else recovered++; }
    for (const virus of this.viruses) if (virus.state === 'attached') attachedViruses++;
    return {
      metrics: { time: this.time, status: this.runStatus, healthy, infected, recovered, activeViruses: this.activeVirusCount(), attachedViruses, immuneAgents: this.immuneCells.length, neutralized: this.neutralizedCount, totalInfections: this.infectionCount, replications: this.replicationCount, peakInfected: this.peak, finishReason: this.reason },
      events: this.events.map(event => ({ ...event, position: cloneVec(event.position) })),
      config: { ...this.config, bounds: cloneVec(this.config.bounds) },
    };
  }

  private createCells(): void {
    const bounds = this.config.bounds;
    for (let i = 0; i < this.config.cellCount; i++) {
      const radius = 0.72 + this.rng.next() * 0.24;
      let position: Vec3 = { x: 0, y: 0, z: 0 };
      let bestClearance = -Infinity;
      // Uniform volume sampling in an ellipsoid avoids visible lattice rows and slab edges.
      // Candidate count is bounded even for physically overpacked custom configurations.
      for (let attempt = 0; attempt < 192; attempt++) {
        const z = this.rng.signed();
        const azimuth = this.rng.next() * Math.PI * 2;
        const radial = Math.cbrt(this.rng.next());
        const xy = Math.sqrt(1 - z * z);
        const candidate = {
          x: Math.cos(azimuth) * xy * radial * (bounds.x - radius - 0.2),
          y: Math.sin(azimuth) * xy * radial * (bounds.y - radius - 0.2),
          z: z * radial * (bounds.z - radius - 0.2),
        };
        let clearance = Infinity;
        for (const other of this.cells) clearance = Math.min(clearance, Math.sqrt(distanceSquared(candidate, other.position)) - radius - other.radius);
        if (clearance > bestClearance) { position = candidate; bestClearance = clearance; }
        if (clearance >= 0.25) break;
      }
      // If non-overlap cannot fit, the candidate with the greatest clearance still stays inside bounds.
      this.cells.push({ id: this.nextId++, position, velocity: { x: 0, y: 0, z: 0 }, age: 0, radius, state: 'healthy', stateAge: 0, infectionProgress: 0, replicationProgress: 0, infections: 0 });
    }
  }

  private direction(): Vec3 {
    let x = this.rng.signed(), y = this.rng.signed(), z = this.rng.signed();
    const length = Math.hypot(x, y, z) || 1;
    return { x: x / length, y: y / length, z: z / length };
  }

  private randomPosition(): Vec3 {
    return { x: this.rng.signed() * this.config.bounds.x * 0.9, y: this.rng.signed() * this.config.bounds.y * 0.9, z: this.rng.signed() * this.config.bounds.z * 0.9 };
  }

  private spawnVirus(origin?: Vec3, radius = 1.3): void {
    const direction = this.direction();
    const cell = this.cells[Math.floor(this.rng.next() * this.cells.length)]!;
    // Initially seed near varied cells so the mechanism is observable within the first seconds.
    const center = origin ?? cell.position;
    const distance = origin ? radius : cell.radius + 0.55 + this.rng.next() * 2.6;
    const position = { x: center.x + direction.x * distance, y: center.y + direction.y * distance, z: center.z + direction.z * distance };
    for (const axis of ['x', 'y', 'z'] as const) position[axis] = clamp(position[axis], -this.config.bounds[axis] + 0.25, this.config.bounds[axis] - 0.25);
    this.viruses.push({ id: this.nextId++, position, velocity: { x: direction.x * 0.7, y: direction.y * 0.7, z: direction.z * 0.7 }, state: 'free', age: 0, attachedCellId: null, phase: this.rng.next() * Math.PI * 2 });
  }

  private createImmuneCell(): ImmuneCell {
    return { id: this.nextId++, position: this.randomPosition(), velocity: { x: 0, y: 0, z: 0 }, age: 0, state: 'patrolling', targetId: null, targetType: null, phase: this.rng.next() * Math.PI * 2 };
  }

  private activeVirusCount(): number {
    let count = 0;
    for (const virus of this.viruses) if (virus.state !== 'neutralized') count++;
    return count;
  }

  private step(): void {
    this.stepCount++;
    this.updateViruses();
    this.updateImmunity();
    this.updateCells();
    this.removeExpiredViruses();
    let infected = 0;
    for (const cell of this.cells) if (cell.state === 'infected') infected++;
    this.peak = Math.max(this.peak, infected);
    if (this.time + 1e-9 >= this.config.duration) this.finish('time');
    else if (!this.activeVirusCount() && !infected) this.finish('contained');
  }

  private updateViruses(): void {
    for (const virus of this.viruses) {
      virus.age += FIXED_STEP;
      if (virus.state === 'neutralized') continue;
      if (virus.state === 'attached') {
        const cell = this.cells.find(cell => cell.id === virus.attachedCellId);
        if (!cell || cell.state !== 'healthy') { this.consumeVirus(virus); continue; }
        cell.infectionProgress = Math.max(cell.infectionProgress, virus.age / this.config.adhesionTime);
        if (virus.age >= this.config.adhesionTime) {
          cell.state = 'infected'; cell.stateAge = 0; cell.infectionProgress = 1; cell.replicationProgress = 0; cell.infections++;
          this.infectionCount++;
          this.emit('infection', cell.position, `Célula ${cell.id} infectada.`, cell.id);
          this.consumeVirus(virus);
        }
        continue;
      }
      if (virus.age >= VIRUS_LIFETIME) { this.consumeVirus(virus); continue; }
      let nearest: Cell | undefined;
      let nearestDistance = 36;
      for (const cell of this.cells) {
        if (cell.state !== 'healthy') continue;
        const d = distanceSquared(virus.position, cell.position);
        if (d < nearestDistance) { nearestDistance = d; nearest = cell; }
      }
      const t = this.time * 0.9 + virus.phase;
      let ax = Math.sin(t * 1.13) * 0.45, ay = Math.cos(t * 0.87) * 0.4, az = Math.sin(t * 0.71) * 0.4;
      if (nearest) {
        const distance = Math.sqrt(nearestDistance) || 1;
        ax += (nearest.position.x - virus.position.x) / distance * 1.25;
        ay += (nearest.position.y - virus.position.y) / distance * 1.25;
        az += (nearest.position.z - virus.position.z) / distance * 1.25;
        if (distance <= nearest.radius + 0.32 && this.rng.next() < 1 - Math.exp(-this.config.infectionRate * FIXED_STEP)) {
          virus.state = 'attached'; virus.attachedCellId = nearest.id; virus.age = 0;
          const dx = (virus.position.x - nearest.position.x) / distance, dy = (virus.position.y - nearest.position.y) / distance, dz = (virus.position.z - nearest.position.z) / distance;
          virus.position = { x: nearest.position.x + dx * (nearest.radius + 0.16), y: nearest.position.y + dy * (nearest.radius + 0.16), z: nearest.position.z + dz * (nearest.radius + 0.16) };
          virus.velocity.x = virus.velocity.y = virus.velocity.z = 0;
          continue;
        }
      }
      this.move(virus.position, virus.velocity, ax, ay, az, 1.5);
    }
  }

  private updateCells(): void {
    const births: { position: Vec3; radius: number; count: number }[] = [];
    let room = this.config.maxViruses - this.activeVirusCount();
    for (const cell of this.cells) {
      cell.age += FIXED_STEP;
      cell.stateAge += FIXED_STEP;
      if (cell.state !== 'infected') continue;
      if (cell.stateAge >= this.config.recoveryTime) { this.recover(cell); continue; }
      cell.replicationProgress += FIXED_STEP / this.config.replicationInterval;
      if (cell.replicationProgress + 1e-9 >= 1) {
        cell.replicationProgress = Math.max(0, cell.replicationProgress - 1);
        const count = Math.min(room, this.config.replicationBurst);
        if (count > 0) {
          births.push({ position: cloneVec(cell.position), radius: cell.radius + 0.4, count });
          room -= count;
          this.replicationCount++;
          this.emit('replication', cell.position, `Célula ${cell.id} liberou ${count} partículas.`, cell.id);
        }
      }
    }
    const birthCount = births.reduce((sum, birth) => sum + birth.count, 0);
    // Death fades share the same render capacity. Drop expired appearances before a burst if needed.
    if (this.viruses.length + birthCount > this.config.maxViruses) this.removeExpiredViruses(true);
    for (const birth of births) for (let i = 0; i < birth.count; i++) this.spawnVirus(birth.position, birth.radius);
  }

  private updateImmunity(): void {
    const strength = 0.8 + this.config.defense * 0.16;
    for (let index = 0; index < this.immuneCells.length; index++) {
      const agent = this.immuneCells[index]!;
      agent.age += FIXED_STEP;
      let target: Virus | Cell | undefined;
      let distance = Infinity;
      let type: 'virus' | 'cell' | null = null;
      for (const virus of this.viruses) {
        if (virus.state === 'neutralized') continue;
        const d = distanceSquared(agent.position, virus.position);
        if (d < distance) { target = virus; distance = d; type = 'virus'; }
      }
      // Some agents prioritize infected cells, making defense visibly address both entity types.
      for (const cell of this.cells) {
        if (cell.state !== 'infected') continue;
        const d = distanceSquared(agent.position, cell.position) * (index % 3 === 0 ? 0.3 : 2.3);
        if (d < distance) { target = cell; distance = d; type = 'cell'; }
      }
      agent.targetId = target?.id ?? null;
      agent.targetType = type;
      agent.state = target ? 'pursuing' : 'patrolling';
      if (target && type) {
        const dx = target.position.x - agent.position.x, dy = target.position.y - agent.position.y, dz = target.position.z - agent.position.z;
        const length = Math.hypot(dx, dy, dz) || 1;
        if (length <= (type === 'cell' ? (target as Cell).radius + 0.4 : 0.66)) {
          agent.state = 'engaging';
          if (type === 'cell') this.recover(target as Cell);
          else {
            const virus = target as Virus;
            this.consumeVirus(virus);
            this.neutralizedCount++;
            this.emit('neutralization', virus.position, 'Partícula neutralizada pela defesa.');
          }
          agent.targetId = null; agent.targetType = null;
        } else this.move(agent.position, agent.velocity, dx / length * strength * 2.4, dy / length * strength * 2.4, dz / length * strength * 2.4, 1.55 + strength * 0.8);
      } else {
        const t = this.time * 0.4 + agent.phase;
        this.move(agent.position, agent.velocity, Math.sin(t) * 0.4, Math.cos(t * 0.8) * 0.4, Math.sin(t * 1.2) * 0.4, 0.8);
      }
    }
  }

  private move(position: Vec3, velocity: Vec3, ax: number, ay: number, az: number, maxSpeed: number): void {
    const drag = 1 - FIXED_STEP * 0.75;
    velocity.x = (velocity.x + ax * FIXED_STEP) * drag;
    velocity.y = (velocity.y + ay * FIXED_STEP) * drag;
    velocity.z = (velocity.z + az * FIXED_STEP) * drag;
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    if (speed > maxSpeed) { const ratio = maxSpeed / speed; velocity.x *= ratio; velocity.y *= ratio; velocity.z *= ratio; }
    for (const axis of ['x', 'y', 'z'] as const) {
      position[axis] += velocity[axis] * FIXED_STEP;
      const bound = this.config.bounds[axis] - 0.2;
      if (position[axis] > bound) { position[axis] = bound; velocity[axis] = -Math.abs(velocity[axis]); }
      if (position[axis] < -bound) { position[axis] = -bound; velocity[axis] = Math.abs(velocity[axis]); }
    }
  }

  private consumeVirus(virus: Virus): void { virus.state = 'neutralized'; virus.age = 0; virus.attachedCellId = null; }
  private recover(cell: Cell): void {
    if (cell.state !== 'infected') return;
    cell.state = 'recovered'; cell.stateAge = 0; cell.replicationProgress = 0;
    this.emit('recovery', cell.position, `Célula ${cell.id} recuperada.`, cell.id);
  }
  private removeExpiredViruses(immediate = false): void {
    for (let i = this.viruses.length - 1; i >= 0; i--) if (this.viruses[i]!.state === 'neutralized' && (immediate || this.viruses[i]!.age >= REMOVAL_TIME)) this.viruses.splice(i, 1);
  }
  private emit(type: SimulationEvent['type'], position: Vec3, message: string, cellId?: number): void {
    this.events.push({ id: this.nextEventId++, type, time: this.time, position: cloneVec(position), ...(cellId === undefined ? {} : { cellId }), message });
    if (this.events.length > EVENT_LIMIT) this.events.splice(0, this.events.length - EVENT_LIMIT);
  }
  private finish(reason: NonNullable<SimulationMetrics['finishReason']>): void {
    if (reason === 'contained') this.removeExpiredViruses(true);
    this.reason = reason; this.runStatus = 'complete';
    this.emit('complete', { x: 0, y: 0, z: 0 }, reason === 'time' ? 'Janela de observação concluída.' : 'Nenhuma partícula ativa ou célula infectada restante.');
  }
}
