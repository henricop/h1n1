import { create } from 'zustand';
import { JourneySimulation } from '../engine/journey/JourneySimulation';
import type { AnatomyLevel, JourneyRendererInfo, JourneySnapshot, RegionId, ScenarioEvent, ScenarioId } from './types';

export const journey = new JourneySimulation();
// The page is an active demonstration: the renderer advances this clock as soon
// as the anatomy is ready. Pausing remains an explicit, always visible control.
journey.play();
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
interface JourneyStore {
  snapshot: JourneySnapshot;
  comparison: { A: JourneySnapshot; B: JourneySnapshot };
  level: AnatomyLevel;
  regionId: RegionId;
  selectedCellSlot: number | null;
  playing: boolean;
  speed: number;
  autoCamera: boolean;
  reducedMotion: boolean;
  presentation: boolean;
  editorOpen: boolean;
  comparisonOpen: boolean;
  graphsOpen: boolean;
  logOpen: boolean;
  info: JourneyRendererInfo | null;
  error: string | null;
  publish: () => void;
  navigate: (level: AnatomyLevel) => void;
  selectRegion: (id: RegionId) => void;
  selectCell: (slot: number | null) => void;
  seek: (hour: number) => void;
  step: (hours: number) => void;
  togglePlay: () => void;
  replay: () => void;
  setSpeed: (speed: number) => void;
  selectScenario: (id: ScenarioId) => void;
  applyEvent: (event: ScenarioEvent) => void;
  removeEvent: (id: string) => void;
  toggleEvent: (id: string, enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setAutoCamera: (enabled: boolean) => void;
  setInfo: (info: JourneyRendererInfo) => void;
  setError: (error: string | null) => void;
}
export const useJourney = create<JourneyStore>((set, get) => ({
  snapshot: journey.getSnapshot(), comparison: journey.getComparison(), level: 'body', regionId: 'nasal', selectedCellSlot: null,
  playing: true, speed: 1, autoCamera: false, reducedMotion: reduced, presentation: false, editorOpen: false, comparisonOpen: false, graphsOpen: false, logOpen: false,
  info: null, error: null,
  publish: () => set({ snapshot: journey.getSnapshot(), playing: journey.status === 'running', speed: journey.speed, ...(get().comparisonOpen ? { comparison: journey.getComparison() } : {}) }),
  navigate: (level) => {
    const state = get();
    const regionId = (level === 'organ' && ['nasal', 'trachea'].includes(state.regionId)) ? 'bronchi' : state.regionId;
    const region = state.snapshot.regions.find((item) => item.regionId === regionId);
    const preferred = region?.cells.find((cell) => cell.status === 'infected') ?? region?.cells.find((cell) => cell.status === 'exposed') ?? region?.cells[0];
    set({ level, regionId, selectedCellSlot: level === 'cell' ? state.selectedCellSlot ?? preferred?.slot ?? 0 : state.selectedCellSlot });
  },
  selectRegion: (regionId) => set({ regionId, selectedCellSlot: null }),
  selectCell: (selectedCellSlot) => set({ selectedCellSlot }),
  seek: (hour) => { journey.seek(hour); get().publish(); },
  step: (hours) => { journey.stepHours(hours); get().publish(); },
  togglePlay: () => { journey.status === 'running' ? journey.pause() : journey.play(); get().publish(); },
  replay: () => { journey.seek(0); journey.play(); get().publish(); },
  setSpeed: (speed) => { journey.setSpeed(speed); get().publish(); },
  selectScenario: (id) => { journey.setActiveScenario(id); get().publish(); },
  applyEvent: (event) => { journey.upsertEvent(event); journey.setActiveScenario('B'); set({ comparison: journey.getComparison() }); get().publish(); },
  removeEvent: (id) => { journey.removeEvent(id); set({ comparison: journey.getComparison() }); get().publish(); },
  toggleEvent: (id, enabled) => { journey.setEventEnabled(id, enabled); set({ comparison: journey.getComparison() }); get().publish(); },
  setReducedMotion: (reducedMotion) => set(reducedMotion ? { reducedMotion, autoCamera: false } : { reducedMotion }),
  setAutoCamera: (autoCamera) => set({ autoCamera }),
  setInfo: (info) => set({ info }),
  setError: (error) => set({ error }),
}));
