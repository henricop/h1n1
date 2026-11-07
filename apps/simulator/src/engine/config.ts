import type { Scenario, SimulationConfig } from './types';

/** Distances and time are arbitrary simulation units, never clinical rates. Bounds are half-extents. */
export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 2009,
  initialViruses: 60,
  cellCount: 80,
  immuneCount: 5,
  defense: 10 / 3,
  infectionRate: 1.25,
  replicationBurst: 4,
  replicationInterval: 7,
  recoveryTime: 34,
  adhesionTime: 1.3,
  maxViruses: 450,
  duration: 180,
  bounds: { x: 15, y: 9, z: 8 },
};

export const SCENARIOS: Scenario[] = [
  { id: 'balanced', name: 'Equilíbrio', description: 'Observe infecção e defesa disputando o mesmo ambiente.', config: { ...DEFAULT_CONFIG, bounds: { ...DEFAULT_CONFIG.bounds } } },
  { id: 'spread', name: 'Propagação', description: 'Mais partículas e uma defesa inicial reduzida.', config: { initialViruses: 100, immuneCount: 2, defense: 4 / 3, infectionRate: 1.65, replicationInterval: 5, replicationBurst: 5, recoveryTime: 40 } },
  { id: 'defense', name: 'Defesa ativa', description: 'Uma resposta mais intensa encontra as partículas cedo.', config: { initialViruses: 60, immuneCount: 12, defense: 8, infectionRate: 1.0, replicationInterval: 8, replicationBurst: 3, recoveryTime: 28 } },
];

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeConfig(input: Partial<SimulationConfig> = {}, base: SimulationConfig = DEFAULT_CONFIG): SimulationConfig {
  const config = { ...base, ...input, bounds: { ...base.bounds, ...input.bounds } };
  const integer = (value: number, fallback: number, min: number, max: number) => Math.round(clamp(finite(value, fallback), min, max));
  config.seed = Math.trunc(finite(config.seed, 2009)) >>> 0;
  config.maxViruses = integer(config.maxViruses, 450, 1, 1000);
  config.initialViruses = integer(config.initialViruses, 60, 0, config.maxViruses);
  config.cellCount = integer(config.cellCount, 80, 1, 160);
  config.immuneCount = integer(config.immuneCount, 5, 0, 15);
  config.defense = clamp(finite(config.defense, 10 / 3), 0, 10);
  config.infectionRate = clamp(finite(config.infectionRate, 1.25), 0, 20);
  config.replicationBurst = integer(config.replicationBurst, 4, 0, 20);
  config.replicationInterval = clamp(finite(config.replicationInterval, 7), 0.5, 120);
  config.recoveryTime = clamp(finite(config.recoveryTime, 34), 1, 180);
  config.adhesionTime = clamp(finite(config.adhesionTime, 1.3), 0.1, 10);
  config.duration = clamp(finite(config.duration, 180), 1, 600);
  for (const axis of ['x', 'y', 'z'] as const) config.bounds[axis] = clamp(finite(config.bounds[axis], DEFAULT_CONFIG.bounds[axis]), 4, 30);
  return config;
}
