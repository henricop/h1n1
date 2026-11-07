import { describe, expect, it } from 'vitest';
import { JourneySimulation } from '../src/engine/journey/JourneySimulation';
import { ADVERSITIES, DEFAULT_JOURNEY_CONFIG, INITIAL_PRESETS } from '../src/engine/journey/config';
import { ANATOMY } from '../src/journey/anatomy';
import type { JourneySnapshot, ScenarioEvent } from '../src/journey/types';

const event = (overrides: Partial<ScenarioEvent> = {}): ScenarioEvent => ({ id: 'sleep-1', kind: 'sleep', startHour: 72, durationHours: 48, intensity: 'high', enabled: true, ...overrides });
const actual = (s: JourneySnapshot) => ({ regions: s.regions, body: s.body, log: s.log, history: s.history });
const at = (sim: JourneySimulation, hour: number) => { sim.seek(hour); return sim.getSnapshot(); };
const round = (n: number) => Math.round(n * 1e8) / 1e8;

describe('one-hour multiscale journey', () => {
  it('starts paused with five real connected regions and organized cell patches', () => {
    const sim = new JourneySimulation(); const s = sim.getSnapshot();
    expect(sim.status).toBe('paused'); expect(sim.hour).toBe(0);
    expect(s.regions).toHaveLength(5); expect(s.regions.map(r => r.regionId)).toEqual(ANATOMY.map(a => a.regionId));
    expect(s.regions.every(r => r.cells.length === 64)).toBe(true);
    expect(s.regions[0]!.viralActivity).toBeGreaterThan(0); expect(s.regions.slice(1).every(r => r.viralActivity === 0)).toBe(true);
    expect(s.regions[0]!.cells.filter(c => c.status === 'exposed').length).toBeGreaterThan(0);
    for (const region of s.regions) {
      expect(new Set(region.cells.map(c => c.id)).size).toBe(region.cells.length);
      expect(region.cells.every(c => Math.abs(c.position.y) < .04)).toBe(true);
    }
  });
  it('replays the same complete state, histories and causal logs after reset', () => {
    const sim = new JourneySimulation({ seed: 8127 }); sim.upsertEvent(event());
    const first = actual(at(sim, 160)); sim.reset(); sim.upsertEvent(event());
    expect(actual(at(sim, 160))).toEqual(first);
  });
  it('hourly clock is independent of frame partition and playback speed', () => {
    const slow = new JourneySimulation(); const partitioned = new JourneySimulation(); const fast = new JourneySimulation();
    slow.play(); slow.advance(36);
    partitioned.play(); for (let i = 0; i < 360; i++) partitioned.advance(.1);
    fast.setSpeed(5); fast.play(); fast.advance(7.2);
    expect(slow.hour).toBe(72); expect(partitioned.hour).toBe(72); expect(fast.hour).toBe(72);
    expect(actual(partitioned.getSnapshot())).toEqual(actual(slow.getSnapshot()));
    expect(actual(fast.getSnapshot())).toEqual(actual(slow.getSnapshot()));
  });
  it('pausing freezes hour, indicators and every cellular state', () => {
    const sim = new JourneySimulation(); sim.play(); sim.advance(30); sim.pause();
    const before = sim.getSnapshot(); sim.advance(1000);
    expect(sim.getSnapshot()).toEqual(before); expect(sim.hour).toBe(60);
  });
  it('scrubbing through snapshots restores exact forward results and never loses the seed', () => {
    const sim = new JourneySimulation({ seed: 13579 }); sim.upsertEvent(event({ kind: 'smoke', targetRegionId: 'bronchi' }));
    const future = actual(at(sim, 208)); const past = actual(at(sim, 51));
    expect(actual(at(sim, 208))).toEqual(future); expect(actual(at(sim, 51))).toEqual(past);
    expect(sim.config.seed).toBe(13579); expect(sim.status).toBe('paused');
  });
  it('future adversity cannot alter any period before its start', () => {
    const sim = new JourneySimulation(); sim.upsertEvent(event()); sim.seek(71);
    const c = sim.getComparison(); expect(actual(c.A)).toEqual(actual(c.B)); expect(c.B.activeEvents).toHaveLength(0);
    sim.seek(72); expect(sim.getSnapshot().activeEvents).toHaveLength(1);
    expect(sim.getSnapshot().log.some(e => e.kind === 'event-started' && e.simulatedHour === 72)).toBe(true);
  });
  it('day-three adversity changes the actual downstream model and preserves baseline', () => {
    const sim = new JourneySimulation(); const baseline = actual(at(sim, 144)); const cacheA = sim.getDiagnostics().snapshotsA;
    sim.upsertEvent(event()); const c = sim.getComparison();
    expect(actual(c.A)).toEqual(baseline); expect(sim.getDiagnostics().snapshotsA).toBe(cacheA);
    expect(c.B.body.viralActivity).not.toBe(c.A.body.viralActivity); expect(c.B.body.tissueIntegrity).not.toBe(c.A.body.tissueIntegrity);
    expect(c.B.log.some(e => e.relatedFactors.some(f => f.includes('sleep-1')))).toBe(true);
  });
  it('removing or disabling an event recovers the exact baseline including RNG stream', () => {
    const sim = new JourneySimulation(); sim.upsertEvent(event()); sim.seek(160); sim.removeEvent('sleep-1');
    let c = sim.getComparison(); expect(actual(c.A)).toEqual(actual(c.B));
    sim.upsertEvent(event()); sim.setEventEnabled('sleep-1', false); c = sim.getComparison(); expect(actual(c.A)).toEqual(actual(c.B));
  });
  it('editing an event affects only B from the earliest changed hour', () => {
    const sim = new JourneySimulation(); sim.upsertEvent(event()); sim.seek(160); const baseline = actual(sim.getSnapshot('A'));
    const before = actual(at(sim, 48)); sim.seek(160); sim.upsertEvent(event({ startHour: 96, durationHours: 24, intensity: 'mild' }));
    expect(actual(sim.getSnapshot('A'))).toEqual(baseline); expect(actual(at(sim, 48))).toEqual(before);
  });
  it('temporary effects expire at their exact configured end and leave a trace', () => {
    const sim = new JourneySimulation(); sim.upsertEvent(event({ durationHours: 12 })); sim.seek(83);
    expect(sim.getSnapshot().activeEvents).toHaveLength(1); sim.seek(84);
    const s = sim.getSnapshot(); expect(s.activeEvents).toHaveLength(0);
    expect(s.log.some(entry => entry.kind === 'event-ended' && entry.simulatedHour === 84)).toBe(true);
    expect(s.regions.every(r => !r.factors.some(f => f.includes('sleep-1')))).toBe(true);
  });
  it('regional modifiers change their target directly without touching unrelated regions retroactively', () => {
    const sim = new JourneySimulation(); sim.upsertEvent(event({ kind: 'smoke', targetRegionId: 'alveoli' })); sim.seek(72);
    const c = sim.getComparison(); const a = c.A.regions.find(r => r.regionId === 'alveoli')!; const b = c.B.regions.find(r => r.regionId === 'alveoli')!;
    expect(b.inflammation).toBeGreaterThan(a.inflammation); expect(b.tissueIntegrity).toBeLessThan(a.tissueIntegrity);
    expect(b.factors.some(f => f.includes('sleep-1'))).toBe(true);
    expect(c.B.regions.filter(r => r.regionId !== 'alveoli').every(r => !r.factors.some(f => f.includes('sleep-1')))).toBe(true);
  });
  it.each(ANATOMY.map(region => region.regionId))('isolates %s random draws so a local event cannot instantly perturb other tissues', (targetRegionId) => {
    const sim = new JourneySimulation();
    sim.upsertEvent(event({ kind: 'smoke', targetRegionId })); sim.seek(72);
    const { A, B } = sim.getComparison();
    for (let i = 0; i < A.regions.length; i++) {
      const original = A.regions[i]!; const modified = B.regions[i]!;
      if (original.regionId !== targetRegionId) expect(modified).toEqual(original);
      else { expect(modified.inflammation).toBeGreaterThan(original.inflammation); expect(modified.tissueIntegrity).toBeLessThan(original.tissueIntegrity); }
    }
    sim.seek(71); const before = sim.getComparison(); expect(actual(before.A)).toEqual(actual(before.B));
  });
  it('cell ratios conserve each modeled population; aggregate indices agree with regions', () => {
    const sim = new JourneySimulation({ initialConditions: INITIAL_PRESETS[1]!.initialConditions });
    for (let hour = 0; hour <= 336; hour += 7) {
      const s = at(sim, hour);
      for (const r of s.regions) {
        expect(r.cells).toHaveLength(64);
        expect(round(r.healthyCellRatio + r.exposedCellRatio + r.infectedCellRatio + r.damagedCellRatio + r.recoveringCellRatio)).toBe(1);
        expect(r.infectedCellRatio).toBe(r.cells.filter(c => c.status === 'infected').length / 64);
        for (const index of [r.viralActivity, r.immuneActivity, r.inflammation, r.tissueIntegrity]) expect(index).toBeGreaterThanOrEqual(0);
        for (const index of [r.viralActivity, r.immuneActivity, r.inflammation, r.tissueIntegrity]) expect(index).toBeLessThanOrEqual(100);
      }
      const weights = [.12, .12, .22, .24, .3];
      for (const key of ['viralActivity', 'immuneActivity', 'inflammation', 'tissueIntegrity'] as const) expect(s.body[key]).toBeCloseTo(s.regions.reduce((sum, r, i) => sum + r[key] * weights[i]!, 0), 10);
    }
  });
  it('damaged cells are removed and replaced with new identities rather than resurrected', () => {
    const sim = new JourneySimulation({ initialConditions: INITIAL_PRESETS[1]!.initialConditions });
    let previous = sim.getSnapshot(); let replacements = 0, damaged = 0;
    for (let hour = 1; hour <= 240; hour++) {
      const s = at(sim, hour);
      s.regions.forEach((region, ri) => region.cells.forEach((cell, slot) => {
        const old = previous.regions[ri]!.cells[slot]!;
        if (cell.status === 'damaged') damaged++;
        if (old.status === 'damaged' && cell.id === old.id) expect(cell.status).not.toBe('healthy');
        if (old.status === 'removed' && cell.status === 'recovering') { expect(cell.id).not.toBe(old.id); expect(cell.generation).toBe(old.generation + 1); expect(cell.age).toBe(0); replacements++; }
      }));
      previous = s;
    }
    expect(damaged).toBeGreaterThan(0); expect(replacements).toBeGreaterThan(0);
  });
  it('different initial conditions can contain distal activity or produce illustrative worsening', () => {
    const protectedModel = new JourneySimulation({ initialConditions: INITIAL_PRESETS[2]!.initialConditions });
    const reduced = new JourneySimulation({ initialConditions: INITIAL_PRESETS[1]!.initialConditions });
    const protectedState = at(protectedModel, 168); const reducedState = at(reduced, 168);
    expect(protectedState.regions.find(r => r.regionId === 'alveoli')!.viralActivity).toBeLessThan(reducedState.regions.find(r => r.regionId === 'alveoli')!.viralActivity);
    expect(reducedState.body.worseningHour).not.toBeNull();
    expect(protectedState.body.stage).toBe('controlled');
  });
  it('supports replay and extension to 21 days with bounded snapshots and logs', () => {
    const sim = new JourneySimulation(); sim.seek(336); expect(sim.status).toBe('complete');
    sim.setHorizon(21); expect(sim.status).toBe('paused'); sim.play(); sim.advance(1000);
    const s = sim.getSnapshot(); expect(sim.hour).toBe(504); expect(sim.status).toBe('complete');
    expect(sim.getDiagnostics().snapshotsA).toBeLessThanOrEqual(85); expect(s.log.length).toBeLessThanOrEqual(256); expect(s.history).toHaveLength(505);
    sim.seek(0); expect(sim.hour).toBe(0); expect(sim.getSnapshot().config.seed).toBe(2009);
  });
  it('bounds extreme clock inputs to the configured horizon without invalid state or an unbounded loop', () => {
    const sim = new JourneySimulation(); sim.seek(Number.MAX_VALUE);
    expect(sim.hour).toBe(336); expect(sim.status).toBe('complete');
    sim.seek(-Number.MAX_VALUE); expect(sim.hour).toBe(0); expect(sim.status).toBe('paused');
    sim.seek(Infinity); sim.seek(NaN); expect(sim.hour).toBe(0);
    sim.setHorizon(21); sim.play(); sim.setSpeed(10); sim.advance(Number.MAX_VALUE);
    expect(sim.hour).toBe(504); expect(sim.status).toBe('complete');
    expect(sim.getSnapshot().history).toHaveLength(505); expect(sim.getDiagnostics().snapshotsA).toBeLessThanOrEqual(85);
  });
  it('snapshots and parallel scenario data cannot alias live model state', () => {
    const sim = new JourneySimulation(); sim.upsertEvent(event()); const s = sim.getSnapshot();
    s.regions[0]!.cells[0]!.position.x = 100; s.body.factors.push('fake'); s.config.initialConditions.defense = 0; s.events[0]!.enabled = false;
    const fresh = sim.getSnapshot(); expect(fresh.regions[0]!.cells[0]!.position.x).not.toBe(100); expect(fresh.body.factors).not.toContain('fake'); expect(fresh.config.initialConditions.defense).toBe(.65); expect(fresh.events[0]!.enabled).toBe(true);
    expect(sim.getSnapshot('A').events).toHaveLength(0);
  });
  it('all nine catalog mechanics are real and their pre-exposure conditions normalize correctly', () => {
    expect(ADVERSITIES).toHaveLength(9);
    const baseline = actual(at(new JourneySimulation(), 96));
    for (const definition of ADVERSITIES) {
      const sim = new JourneySimulation(); sim.upsertEvent(event({ kind: definition.kind, startHour: 24, durationHours: 120 }));
      const s = at(sim, 96); expect(actual(s)).not.toEqual(baseline);
      expect(s.events[0]!.startHour).toBe(definition.initialOnly ? 0 : 24);
      expect(s.log.some(e => e.relatedFactors.some(f => f.includes('sleep-1')))).toBe(true);
    }
  });
  it('invalid inputs are bounded and renderer-like snapshot reads cannot change the outcome', () => {
    const sim = new JourneySimulation({ seed: NaN, cellsPerRegion: -100, initialConditions: { ...DEFAULT_JOURNEY_CONFIG.initialConditions, defense: Infinity } });
    expect(sim.config.seed).toBe(2009); expect(sim.config.cellsPerRegion).toBe(16); expect(sim.config.initialConditions.defense).toBe(.65);
    sim.seek(-500); expect(sim.hour).toBe(0); sim.seek(NaN); expect(sim.hour).toBe(0); sim.setSpeed(NaN); expect(sim.speed).toBe(1);
    const a = new JourneySimulation(); const b = new JourneySimulation(); a.play(); b.play();
    for (let i = 0; i < 72; i++) { a.advance(.5); a.getSnapshot(); a.getComparison(); }
    b.advance(36); expect(actual(a.getSnapshot())).toEqual(actual(b.getSnapshot()));
  });
});
