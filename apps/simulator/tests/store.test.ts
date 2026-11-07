import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The state/UI bridge is testable without a GPU or a browser. This minimal media
// preference stub is test-only; the production app uses the real browser value.
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('UI state is connected to the real engine', () => {
  it('publishes actual populations and detached snapshots instead of synthetic counters', async () => {
    const { simulation, useSimulator } = await import('../src/store');
    const initial = useSimulator.getState().snapshot;
    simulation.pause();
    simulation.addViruses(20);
    expect(useSimulator.getState().snapshot.metrics.activeViruses).toBe(60);
    useSimulator.getState().publish();
    expect(useSimulator.getState().snapshot.metrics.activeViruses).toBe(80);
    expect(useSimulator.getState().snapshot.metrics.status).toBe('paused');
    expect(initial.metrics.activeViruses).toBe(60);
    expect(simulation.cells).toHaveLength(80);
  });

  it('speed control changes model time and UI selection together', async () => {
    const { simulation, useSimulator } = await import('../src/store');
    useSimulator.getState().setSpeed(2);
    simulation.advance(1);
    useSimulator.getState().publish();
    expect(useSimulator.getState().speed).toBe(2);
    expect(useSimulator.getState().snapshot.metrics.time).toBeCloseTo(2, 8);
  });

  it('honors the initial reduced-motion preference and disables automatic camera intent', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const { useSimulator } = await import('../src/store');
    expect(useSimulator.getState().reducedMotion).toBe(true);
    expect(useSimulator.getState().autoCamera).toBe(false);
    useSimulator.getState().setReducedMotion(false);
    useSimulator.getState().setAutoCamera(true);
    useSimulator.getState().setReducedMotion(true);
    expect(useSimulator.getState().autoCamera).toBe(false);
  });

  it('reset can be published without retaining stale virus counts or advancing the seed', async () => {
    const { simulation, useSimulator } = await import('../src/store');
    simulation.addViruses(20);
    simulation.advance(6);
    simulation.reset({ seed: 8127, initialViruses: 40 });
    useSimulator.getState().selectCell(null);
    useSimulator.getState().setSpeed(1);
    useSimulator.getState().publish();
    const state = useSimulator.getState();
    expect(state.snapshot.config.seed).toBe(8127);
    expect(state.snapshot.metrics).toMatchObject({ time: 0, healthy: 80, infected: 0, recovered: 0, activeViruses: 40 });
    expect(state.selectedCell).toBeNull();
  });
});
