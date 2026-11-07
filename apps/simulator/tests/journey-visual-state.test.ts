import { describe, expect, it } from 'vitest';
import { BufferGeometry } from 'three';
import { JourneySimulation } from '../src/engine/journey/JourneySimulation';
import { nextCalculatedMilestone } from '../src/journey/nextMilestone';
import { patientState } from '../src/journey/patientState';
import { regionVisual, cellVisualScale } from '../src/journey/visualState';
import { virusGeometry } from '../src/atlas/AtlasActivityLayer';

describe('visible journey contract', () => {
  it('builds a real merged virus mesh for the live 3D activity layer', () => {
    const geometry = virusGeometry();
    expect(geometry).toBeInstanceOf(BufferGeometry);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(100);
    geometry.dispose();
  });
  it('derives a simulated person and region phase from the same hour', () => {
    const sim = new JourneySimulation();
    const initial = sim.getSnapshot();
    expect(patientState(initial).title).toBe('Initial contact');
    expect(patientState(initial).symptoms).toContain('No apparent symptoms');
    expect(regionVisual(initial.regions[0]!).phase).toBe('contact');
    expect(regionVisual(initial.regions[1]!).phase).toBe('quiet');
    sim.seek(72);
    const later = sim.getSnapshot();
    expect(patientState(later).title).toBeTruthy();
    expect(patientState(later).viral).toBe(Math.round(later.body.viralActivity));
    expect(patientState(later).integrity).toBe(Math.round(later.body.tissueIntegrity));
  });
  it('increasing viral rhythm changes only the future of scenario B', () => {
    const sim = new JourneySimulation();
    sim.seek(24);
    const aBefore = sim.getSnapshot('A');
    sim.upsertEvent({ id: 'viral-control-25', kind: 'viral-rate', startHour: 25, durationHours: 200, intensity: 'high', enabled: true });
    expect(sim.getSnapshot('B').regions).toEqual(aBefore.regions);
    sim.seek(96);
    const a = sim.getSnapshot('A'), b = sim.getSnapshot('B');
    expect(b.regions).not.toEqual(a.regions);
    expect(b.regions[0]!.viralActivity).toBeGreaterThan(a.regions[0]!.viralActivity);
    sim.setEventEnabled('viral-control-25', false);
    expect(sim.getSnapshot('B').regions).toEqual(a.regions);
  });
  it('next calculated milestone does not move the live clock', () => {
    const sim = new JourneySimulation();
    sim.seek(24);
    const before = sim.getSnapshot();
    const next = nextCalculatedMilestone(before);
    expect(next?.simulatedHour).toBeGreaterThan(24);
    expect(sim.hour).toBe(24);
    expect(sim.getSnapshot()).toEqual(before);
  });
  it('damaged and replacement cells change shape with simulation time', () => {
    const sim = new JourneySimulation();
    const cell = sim.getSnapshot().regions[0]!.cells[0]!;
    const damaged = { ...cell, status: 'damaged' as const, sinceHour: 12 };
    const recovering = { ...cell, status: 'recovering' as const, sinceHour: 20 };
    expect(cellVisualScale(damaged, 12)).toBe(1);
    expect(cellVisualScale(damaged, 16)).toBeCloseTo(.62);
    expect(cellVisualScale(recovering, 20)).toBe(.25);
    expect(cellVisualScale(recovering, 32)).toBe(1);
  });
});
