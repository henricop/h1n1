import { create } from 'zustand';
import { Simulation } from './engine/Simulation';
import { DEFAULT_CONFIG } from './engine/config';
import type { SimulationSnapshot } from './engine/types';

export const simulation = new Simulation(DEFAULT_CONFIG);
export interface RendererInfo { backend: 'WebGPU' | 'WebGL 2'; fps: number; quality: string }
interface SimulatorStore {
  snapshot: SimulationSnapshot;
  selectedCell: number | null;
  speed: number;
  autoCamera: boolean;
  reducedMotion: boolean;
  rendererInfo: RendererInfo | null;
  error: string | null;
  publish: () => void;
  selectCell: (id: number | null) => void;
  setSpeed: (speed: number) => void;
  setAutoCamera: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  setRendererInfo: (info: RendererInfo) => void;
  setError: (error: string | null) => void;
}
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const useSimulator = create<SimulatorStore>((set) => ({
  snapshot: simulation.getSnapshot(), selectedCell: null, speed: 1,
  autoCamera: !prefersReducedMotion, reducedMotion: prefersReducedMotion,
  rendererInfo: null, error: null,
  publish: () => set({ snapshot: simulation.getSnapshot() }),
  selectCell: (id) => set({ selectedCell: id }),
  setSpeed: (speed) => { simulation.setSpeed(speed); set({ speed }); },
  setAutoCamera: (autoCamera) => set({ autoCamera }),
  setReducedMotion: (reducedMotion) => set(reducedMotion ? { reducedMotion, autoCamera: false } : { reducedMotion }),
  setRendererInfo: (rendererInfo) => set({ rendererInfo }),
  setError: (error) => set({ error }),
}));
