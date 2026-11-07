import { ANATOMY } from '../../journey/anatomy';
import type { JourneyConfig, JourneyModel, JourneySnapshot, ScenarioEvent, ScenarioId } from '../../journey/types';
import { ADVERSITIES, clamp, normalizeJourneyConfig } from './config';
import { activeAt } from './EventModifierSystem';
import type { ScenarioBranch } from './internal';
import { clone, computeBranch, createBranch, invalidateBranch } from './ScenarioBranchManager';
import { SimulationClock } from './SimulationClock';

export class JourneySimulation implements JourneyModel {
  config: JourneyConfig;
  private clock: SimulationClock;
  private branches: Record<ScenarioId, ScenarioBranch>;
  private events: ScenarioEvent[] = [];
  private active: ScenarioId = 'A';
  private steps = 0;
  constructor(config: Partial<JourneyConfig> = {}) {
    this.config = normalizeJourneyConfig(config);
    this.clock = new SimulationClock(this.config.horizonDays * 24);
    this.branches = { A: createBranch(this.config, []), B: createBranch(this.config, []) };
  }
  get hour(): number { return this.clock.hour; }
  get visualHour(): number { return this.clock.visualHour; }
  get status(): JourneyModel['status'] { return this.clock.status; }
  get speed(): number { return this.clock.speed; }
  get activeScenario(): ScenarioId { return this.active; }
  play(): void { this.clock.play(); }
  pause(): void { this.clock.pause(); }
  setSpeed(value: number): void { this.clock.setSpeed(value); }
  advance(seconds: number): void { this.clock.advance(seconds, hour => { this.compute(this.active, hour); }); }
  seek(hour: number): void { if (!Number.isFinite(hour)) return; this.clock.seek(hour); this.compute(this.active, this.hour); }
  stepHours(hours: number): void { if (Number.isFinite(hours)) this.seek(this.hour + Math.round(hours)); }
  setActiveScenario(id: ScenarioId): void { if (id === 'A' || id === 'B') { this.active = id; this.compute(id, this.hour); } }
  reset(config: Partial<JourneyConfig> = {}): void {
    this.config = normalizeJourneyConfig(config, this.config); this.clock.reset(this.config.horizonDays * 24);
    this.events = []; this.active = 'A'; this.steps = 0;
    this.branches = { A: createBranch(this.config, []), B: createBranch(this.config, []) };
  }
  setHorizon(days: 14 | 21): void {
    this.config = { ...this.config, horizonDays: days === 21 ? 21 : 14 };
    this.clock.maxHour = this.config.horizonDays * 24;
    if (this.hour > this.clock.maxHour) this.seek(this.clock.maxHour);
    else if (this.status === 'complete' && this.hour < this.clock.maxHour) this.clock.status = 'paused';
  }
  private compute(id: ScenarioId, hour: number) {
    return computeBranch(this.branches[id], hour, this.config, id === 'A' ? [] : this.events, () => { this.steps++; });
  }
  private normalizeEvent(event: ScenarioEvent): ScenarioEvent {
    const definition = ADVERSITIES.find(item => item.kind === event.kind);
    if (!definition) throw new Error('Tipo de evento desconhecido.');
    const start = Number.isFinite(event.startHour) ? Math.round(clamp(event.startHour, 0, 504)) : 0;
    const duration = Number.isFinite(event.durationHours) ? Math.round(clamp(event.durationHours, 1, 504)) : definition.defaultDuration;
    const intensity = ['mild', 'moderate', 'high'].includes(event.intensity) ? event.intensity : 'moderate';
    const normalized: ScenarioEvent = { id: String(event.id).slice(0, 80), kind: event.kind, startHour: definition.initialOnly ? 0 : start, durationHours: duration, intensity, enabled: Boolean(event.enabled) };
    if (event.targetRegionId && ANATOMY.some(region => region.regionId === event.targetRegionId)) normalized.targetRegionId = event.targetRegionId;
    return normalized;
  }
  upsertEvent(input: ScenarioEvent): void {
    const event = this.normalizeEvent(input);
    const old = this.events.find(item => item.id === event.id);
    if (!old && this.events.length >= 40) throw new Error('Limite de 40 eventos por cenário.');
    const affected = old ? Math.min(old.startHour, event.startHour) : event.startHour;
    this.events = [...this.events.filter(item => item.id !== event.id), event].sort((a, b) => a.startHour - b.startHour || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.branches.B = invalidateBranch(this.branches.B, affected, this.config, this.events);
    this.active = 'B'; this.clock.pause(); this.compute('B', this.hour);
  }
  removeEvent(id: string): void {
    const old = this.events.find(item => item.id === id); if (!old) return;
    this.events = this.events.filter(item => item.id !== id);
    this.branches.B = invalidateBranch(this.branches.B, old.startHour, this.config, this.events);
    this.clock.pause(); this.compute('B', this.hour);
  }
  setEventEnabled(id: string, enabled: boolean): void {
    const event = this.events.find(item => item.id === id); if (event) this.upsertEvent({ ...event, enabled });
  }
  getSnapshot(id: ScenarioId = this.active): JourneySnapshot {
    const state = this.compute(id, this.hour);
    const events = id === 'A' ? [] : this.events;
    return {
      scenarioId: id, simulatedHour: this.hour, config: clone(this.config), body: clone(state.body),
      regions: state.regions.map(({ viralPool: _pool, immuneMemory: _memory, everInfected: _ever, ...region }) => clone(region)),
      events: clone(events), activeEvents: clone(events.filter(event => activeAt(event, this.hour))), log: clone(state.log), history: clone(state.history),
    };
  }
  getComparison(): { A: JourneySnapshot; B: JourneySnapshot } { return { A: this.getSnapshot('A'), B: this.getSnapshot('B') }; }
  getDiagnostics() {
    return { snapshotsA: this.branches.A.snapshots.size, snapshotsB: this.branches.B.snapshots.size, simulatedSteps: this.steps,
      cachedUntilA: Math.max(this.branches.A.snapshots.lastHour, this.branches.A.state.hour), cachedUntilB: Math.max(this.branches.B.snapshots.lastHour, this.branches.B.state.hour) };
  }
}
