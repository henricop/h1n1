import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneySnapshot, ScenarioEvent } from '../src/journey/types';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
});
afterEach(() => vi.unstubAllGlobals());
const sleep: ScenarioEvent = { id: 'ui-sleep-72', kind: 'sleep', startHour: 72, durationHours: 48, intensity: 'high', enabled: true };
const biology = (s: JourneySnapshot) => ({ regions: s.regions, body: s.body, history: s.history, log: s.log });

describe('journey UI store is wired to the actual regional engine', () => {
  it('opens at the body with the real simulation already running', async () => {
    const { journey, useJourney } = await import('../src/journey/store');
    const initial = useJourney.getState();
    expect(initial.level).toBe('body'); expect(initial.snapshot.simulatedHour).toBe(0);
    expect(initial.playing).toBe(true); expect(journey.status).toBe('running'); expect(initial.snapshot.regions).toHaveLength(5);
    journey.advance(12);
    expect(useJourney.getState().snapshot.simulatedHour).toBe(0);
    useJourney.getState().publish();
    expect(useJourney.getState().snapshot.simulatedHour).toBe(24);
    expect(useJourney.getState().playing).toBe(true);
    expect(useJourney.getState().snapshot.regions).toEqual(journey.getSnapshot().regions);
  });

  it('navigating scales and selecting a region never changes the clock, seed or branch', async () => {
    const { journey, useJourney } = await import('../src/journey/store');
    useJourney.getState().seek(144); useJourney.getState().applyEvent(sleep);
    const before = biology(journey.getSnapshot());
    useJourney.getState().selectRegion('bronchi');
    for (const level of ['respiratory', 'organ', 'tissue', 'cell', 'body'] as const) {
      useJourney.getState().navigate(level);
      expect(journey.hour).toBe(144); expect(journey.activeScenario).toBe('B'); expect(journey.config.seed).toBe(2009);
      expect(biology(journey.getSnapshot())).toEqual(before);
    }
    expect(useJourney.getState().regionId).toBe('bronchi');
  });

  it('applying a day-three event changes B at day six while preserving the real A result', async () => {
    const { journey, useJourney } = await import('../src/journey/store');
    useJourney.getState().seek(144); const original = biology(journey.getSnapshot('A'));
    useJourney.getState().applyEvent(sleep);
    const state = useJourney.getState();
    expect(state.snapshot.scenarioId).toBe('B'); expect(state.playing).toBe(false);
    expect(biology(state.comparison.A)).toEqual(original);
    expect(state.snapshot.body.viralActivity).not.toBe(state.comparison.A.body.viralActivity);
    expect(state.snapshot.regions).toEqual(state.comparison.B.regions);
    expect(state.comparison.B.events).toEqual([sleep]);
  });

  it('scrubbing before an event restores baseline biology and leaves the scheduled choice intact', async () => {
    const { useJourney } = await import('../src/journey/store');
    useJourney.getState().applyEvent(sleep); useJourney.setState({ comparisonOpen: true });
    useJourney.getState().seek(144); const future = biology(useJourney.getState().snapshot);
    useJourney.getState().seek(71);
    let state = useJourney.getState();
    expect(state.snapshot.activeEvents).toHaveLength(0);
    expect(biology(state.comparison.A)).toEqual(biology(state.comparison.B));
    expect(state.snapshot.events).toEqual([sleep]);
    useJourney.getState().seek(144); state = useJourney.getState();
    expect(biology(state.snapshot)).toEqual(future);
  });

  it('removing an intervention updates comparison and restores the exact baseline', async () => {
    const { journey, useJourney } = await import('../src/journey/store');
    useJourney.getState().applyEvent(sleep); useJourney.getState().seek(144);
    useJourney.getState().removeEvent(sleep.id);
    const state = useJourney.getState();
    expect(state.comparison.B.events).toHaveLength(0);
    expect(biology(state.comparison.B)).toEqual(biology(state.comparison.A));
    expect(biology(state.snapshot)).toEqual(biology(journey.getSnapshot('A')));
  });

  it('replay preserves seed, initial conditions and events instead of clearing the experiment', async () => {
    const { journey, useJourney } = await import('../src/journey/store');
    useJourney.getState().applyEvent(sleep); useJourney.getState().seek(144);
    const future = biology(useJourney.getState().snapshot);
    useJourney.getState().replay();
    expect(journey.hour).toBe(0); expect(journey.status).toBe('running'); expect(journey.activeScenario).toBe('B');
    expect(useJourney.getState().snapshot.events).toEqual([sleep]); expect(journey.config.seed).toBe(2009);
    journey.advance(72); useJourney.getState().publish();
    expect(biology(useJourney.getState().snapshot)).toEqual(future);
  });

  it('scenario switching changes the visible branch without advancing its time', async () => {
    const { useJourney } = await import('../src/journey/store');
    useJourney.getState().applyEvent(sleep); useJourney.getState().seek(144);
    const modified = biology(useJourney.getState().snapshot);
    useJourney.getState().selectScenario('A'); const original = biology(useJourney.getState().snapshot);
    expect(useJourney.getState().snapshot.simulatedHour).toBe(144); expect(useJourney.getState().snapshot.events).toHaveLength(0);
    useJourney.getState().selectScenario('B');
    expect(biology(useJourney.getState().snapshot)).toEqual(modified); expect(modified).not.toEqual(original);
  });

  it('preset/reset publishes a fresh paused clock and chosen seed, and clears both event branches', async () => {
    const { journey, useJourney } = await import('../src/journey/store');
    const { INITIAL_PRESETS } = await import('../src/engine/journey/config');
    useJourney.getState().applyEvent(sleep); useJourney.getState().seek(120); useJourney.getState().setSpeed(5);
    journey.reset({ seed: 8127, horizonDays: 21, initialConditions: INITIAL_PRESETS[1]!.initialConditions });
    useJourney.getState().publish(); useJourney.setState({ comparison: journey.getComparison(), level: 'body', regionId: 'nasal', selectedCellSlot: null });
    const state = useJourney.getState();
    expect(state.snapshot.simulatedHour).toBe(0); expect(state.playing).toBe(false); expect(state.speed).toBe(1);
    expect(state.snapshot.config).toMatchObject({ seed: 8127, horizonDays: 21, initialConditions: INITIAL_PRESETS[1]!.initialConditions });
    expect(state.comparison.A.events).toHaveLength(0); expect(state.comparison.B.events).toHaveLength(0);
    expect(state.snapshot.regions.every(region => region.cells.length === 64)).toBe(true);
  });

  it('movement preferences affect only rendering intent and do not alter model indices', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const { journey, useJourney } = await import('../src/journey/store');
    expect(useJourney.getState().reducedMotion).toBe(true); expect(useJourney.getState().autoCamera).toBe(false);
    useJourney.getState().seek(72); const biologyBefore = biology(journey.getSnapshot());
    useJourney.getState().setReducedMotion(false); useJourney.getState().setAutoCamera(true);
    useJourney.getState().setReducedMotion(true);
    expect(useJourney.getState().autoCamera).toBe(false); expect(biology(journey.getSnapshot())).toEqual(biologyBefore);
  });
});
