import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, normalizeConfig, SCENARIOS } from '../src/engine/config';
import { FIXED_STEP, SeededRandom, Simulation } from '../src/engine/Simulation';

function signature(sim: Simulation) { return JSON.stringify({ snapshot: sim.getSnapshot(), cells: sim.cells, viruses: sim.viruses, immuneCells: sim.immuneCells }); }
function run(sim: Simulation, seconds: number) { for (let i = 0; i < seconds * 60; i++) sim.advance(FIXED_STEP); }

describe('seeded fixed-step simulation', () => {
  it('starts with the requested real entity counts and independent config objects', () => {
    const a = new Simulation(); const b = new Simulation();
    expect(a.cells).toHaveLength(80); expect(a.viruses).toHaveLength(60); expect(a.immuneCells).toHaveLength(5);
    expect(a.getSnapshot().metrics).toMatchObject({ healthy: 80, infected: 0, recovered: 0, activeViruses: 60, time: 0, status: 'running' });
    a.config.bounds.x = 9; expect(b.config.bounds.x).toBe(15); expect(DEFAULT_CONFIG.bounds.x).toBe(15);
  });
  it('places default cells organically with membrane separation and radius-aware bounds', () => {
    for (const seed of [2009, 713, 1, 42]) {
      const sim = new Simulation({ seed });
      for (let i = 0; i < sim.cells.length; i++) {
        const cell = sim.cells[i]!;
        for (const axis of ['x', 'y', 'z'] as const) expect(Math.abs(cell.position[axis]) + cell.radius).toBeLessThan(sim.config.bounds[axis]);
        for (let j = i + 1; j < sim.cells.length; j++) {
          const other = sim.cells[j]!;
          const distance = Math.hypot(cell.position.x - other.position.x, cell.position.y - other.position.y, cell.position.z - other.position.z);
          expect(distance - cell.radius - other.radius).toBeGreaterThanOrEqual(0.25 - 1e-9);
        }
      }
      // Every coordinate is sampled rather than drawn from a small stack of lattice levels.
      for (const axis of ['x', 'y', 'z'] as const) expect(new Set(sim.cells.map(cell => cell.position[axis].toFixed(3))).size).toBeGreaterThan(70);
    }
  });
  it('bounded placement still completes for deliberately overpacked custom volumes', () => {
    const sim = new Simulation({ cellCount: 160, bounds: { x: 4, y: 4, z: 4 } });
    expect(sim.cells).toHaveLength(160);
    for (const cell of sim.cells) for (const axis of ['x', 'y', 'z'] as const) expect(Math.abs(cell.position[axis]) + cell.radius).toBeLessThan(4);
    const initial = signature(sim); sim.reset(); expect(signature(sim)).toBe(initial);
  });
  it.each(SCENARIOS.map(scenario => [scenario.id, scenario.config] as const))('preserves counts and population limits for the %s preset', (_id, config) => {
    const sim = new Simulation({ ...DEFAULT_CONFIG, ...config });
    expect(sim.getSnapshot().metrics).toMatchObject({ healthy: sim.config.cellCount, infected: 0, recovered: 0, activeViruses: sim.config.initialViruses, immuneAgents: sim.config.immuneCount });
    for (let second = 0; second < 45; second++) {
      sim.advance(1);
      const m = sim.getSnapshot().metrics;
      expect(m.healthy + m.infected + m.recovered).toBe(sim.config.cellCount);
      expect(m.totalInfections).toBe(m.infected + m.recovered);
      expect(m.activeViruses).toBe(sim.viruses.filter(virus => virus.state !== 'neutralized').length);
      expect(m.attachedViruses).toBe(sim.viruses.filter(virus => virus.state === 'attached').length);
      expect(m.immuneAgents).toBe(sim.immuneCells.length);
      expect(sim.viruses.length).toBeLessThanOrEqual(sim.config.maxViruses);
    }
  });
  it('replays identical state, events and IDs after resetting the same seed', () => {
    const sim = new Simulation({ seed: 713 }); run(sim, 24); const first = signature(sim);
    sim.setSpeed(5); sim.setSpeed(1); sim.reset(); run(sim, 24); expect(signature(sim)).toBe(first);
  });
  it('is independent of render frame partitioning', () => {
    const a = new Simulation(); const b = new Simulation();
    run(a, 12); for (let i = 0; i < 120; i++) b.advance(0.1);
    expect(signature(a)).toBe(signature(b));
  });
  it('different seeds create different realizations; seeded RNG is repeatable', () => {
    expect(new SeededRandom(5).next()).toBe(new SeededRandom(5).next());
    expect(signature(new Simulation({ seed: 1 }))).not.toBe(signature(new Simulation({ seed: 2 })));
  });
  it('pause freezes every entity and speed controls simulated rather than wall time', () => {
    const sim = new Simulation(); run(sim, 1); sim.pause(); const paused = signature(sim);
    sim.advance(50); expect(signature(sim)).toBe(paused);
    sim.play(); sim.setSpeed(2); sim.advance(1); expect(sim.time).toBeCloseTo(3, 8);
    sim.reset(); sim.advance(1); expect(sim.time).toBeCloseTo(1, 8);
  });
  it('moves through actual adhesion, infection, replication and recovery', () => {
    const sim = new Simulation({ immuneCount: 0, defense: 0, initialViruses: 120, recoveryTime: 18, replicationInterval: 3 });
    let attached = false, infected = false, replicated = false, recovered = false;
    for (let i = 0; i < 32 * 60; i++) {
      sim.advance(FIXED_STEP);
      const m = sim.getSnapshot().metrics;
      attached ||= m.attachedViruses > 0; infected ||= m.infected > 0; replicated ||= m.replications > 0; recovered ||= m.recovered > 0;
      expect(m.healthy + m.infected + m.recovered).toBe(80);
      expect(m.activeViruses).toBeLessThanOrEqual(sim.config.maxViruses);
      expect(sim.viruses.length).toBeLessThanOrEqual(sim.config.maxViruses);
      expect(m.attachedViruses).toBeLessThanOrEqual(m.activeViruses);
    }
    expect([attached, infected, replicated, recovered]).toEqual([true, true, true, true]);
  });
  it('shows infection within the first eight seconds of the default experiment', () => {
    const sim = new Simulation(); run(sim, 8); expect(sim.getSnapshot().metrics.totalInfections).toBeGreaterThan(0);
  });
  it('immune agents pursue and neutralize real targets', () => {
    const sim = new Simulation({ defense: 10, immuneCount: 15 }); run(sim, 15);
    expect(sim.getSnapshot().metrics.neutralized).toBeGreaterThan(0);
    expect(sim.immuneCells.some(agent => agent.targetId !== null)).toBe(true);
  });
  it('live defense and viral additions change the engine, stay bounded, and work while paused', () => {
    const sim = new Simulation({ maxViruses: 100 }); sim.pause();
    sim.setDefense(10); expect(sim.immuneCells).toHaveLength(15); sim.setDefense(0); expect(sim.immuneCells).toHaveLength(0);
    sim.addViruses(1000); expect(sim.getSnapshot().metrics.activeViruses).toBe(100); expect(sim.status).toBe('paused');
    expect(sim.events.at(-1)?.type).toBe('seed');
  });
  it('ends by time or containment, but allows interventions after the end', () => {
    const timed = new Simulation({ duration: 2 }); run(timed, 3);
    expect(timed.time).toBeCloseTo(2); expect(timed.getSnapshot().metrics.finishReason).toBe('time');
    timed.addViruses(5); expect(timed.status).toBe('running'); expect(timed.config.duration).toBeGreaterThan(2);
    const clear = new Simulation({ initialViruses: 0 }); clear.advance(FIXED_STEP);
    expect(clear.getSnapshot().metrics.finishReason).toBe('contained');
    clear.addViruses(5); expect(clear.status).toBe('running'); clear.advance(1); expect(clear.time).toBeGreaterThan(1);
  });
  it('does not end while an infected cell can still replicate', () => {
    const sim = new Simulation({ initialViruses: 0, immuneCount: 0 }); sim.cells[0]!.state = 'infected';
    sim.advance(1); expect(sim.status).toBe('running'); sim.advance(8); expect(sim.viruses.length).toBeGreaterThan(0);
  });
  it('snapshots are detached from mutable events and config; event history is bounded', () => {
    const sim = new Simulation(); for (let i = 0; i < 40; i++) sim.addViruses(1);
    const snapshot = sim.getSnapshot(); expect(snapshot.events).toHaveLength(30);
    snapshot.config.bounds.x = 200; snapshot.events[0]!.position.x = 100; snapshot.events.length = 0;
    expect(sim.config.bounds.x).toBe(15); expect(sim.events).toHaveLength(30); expect(sim.events[0]!.position.x).not.toBe(100);
  });
  it('keeps moving entities finite and within bounds over long high-speed runs', () => {
    const sim = new Simulation({ ...SCENARIOS[1]!.config, maxViruses: 120 }); sim.setSpeed(5);
    for (let i = 0; i < 180; i++) {
      sim.advance(0.2);
      for (const entity of [...sim.viruses, ...sim.immuneCells]) for (const axis of ['x', 'y', 'z'] as const) {
        expect(Number.isFinite(entity.position[axis])).toBe(true); expect(Math.abs(entity.position[axis])).toBeLessThanOrEqual(sim.config.bounds[axis]);
      }
    }
  });
  it('rejects invalid controls and normalizes unsafe configuration', () => {
    const config = normalizeConfig({ seed: NaN, maxViruses: -1, initialViruses: 900, cellCount: Infinity, defense: -5, bounds: { x: 0, y: NaN, z: 90 } });
    expect(config).toMatchObject({ seed: 2009, maxViruses: 1, initialViruses: 1, cellCount: 80, defense: 0, bounds: { x: 4, y: 9, z: 30 } });
    const sim = new Simulation(); sim.advance(NaN); sim.setSpeed(NaN); sim.setDefense(NaN); sim.addViruses(NaN); expect(sim.time).toBe(0); expect(sim.viruses).toHaveLength(60);
  });
});
