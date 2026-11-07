import type { Vec3 } from '../engine/types';
export type { Vec3 };
export type AnatomyLevel = 'body' | 'respiratory' | 'organ' | 'tissue' | 'cell';
export type RegionId = 'nasal' | 'trachea' | 'bronchi' | 'bronchioles' | 'alveoli';
export type ScenarioId = 'A' | 'B';
export type CellStatus = 'healthy' | 'exposed' | 'infected' | 'damaged' | 'controlled' | 'removed' | 'recovering';
export type JourneyStage = 'exposure' | 'local' | 'response' | 'recovering' | 'worsening' | 'controlled';
export type AdversityKind = 'sleep' | 'stress' | 'smoke' | 'dehydration' | 'reduced-defense' | 'respiratory-vulnerability' | 'prior-protection' | 'rest' | 'viral-rate';
export interface InitialConditions { defense: number; resilience: number; protection: number; vulnerability: number; exposure: number }
export interface JourneyConfig { seed: number; horizonDays: 14 | 21; cellsPerRegion: number; initialConditions: InitialConditions }
export interface JourneyCell { id: string; slot: number; generation: number; status: CellStatus; sinceHour: number; age: number; position: Vec3; infectionAge: number; damage: number }
export interface RegionState {
  regionId: RegionId; cells: JourneyCell[]; viralActivity: number; immuneActivity: number; inflammation: number; tissueIntegrity: number;
  healthyCellRatio: number; exposedCellRatio: number; infectedCellRatio: number; damagedCellRatio: number; recoveringCellRatio: number;
  representativeViruses: number; representativeDefenders: number; repairedCells: number; factors: string[];
}
export interface BodyState { viralActivity: number; immuneActivity: number; inflammation: number; tissueIntegrity: number; discomfort: number; condition: number; stage: JourneyStage; factors: string[]; recoveryHour: number | null; worseningHour: number | null }
export interface ScenarioEvent { id: string; kind: AdversityKind; startHour: number; durationHours: number; intensity: 'mild' | 'moderate' | 'high'; targetRegionId?: RegionId; enabled: boolean }
export interface AdversityDefinition { kind: AdversityKind; title: string; description: string; parameter: string; regional: boolean; initialOnly?: boolean; defaultDuration: number }
export interface JourneyLogEntry { id: string; simulatedHour: number; kind: string; regionId: RegionId; relatedFactors: string[]; title: string; explanation: string; level: AnatomyLevel }
export interface HistoryPoint { hour: number; viralActivity: number; immuneActivity: number; inflammation: number; tissueIntegrity: number; condition: number }
export interface JourneySnapshot { scenarioId: ScenarioId; simulatedHour: number; config: JourneyConfig; regions: RegionState[]; body: BodyState; events: ScenarioEvent[]; activeEvents: ScenarioEvent[]; log: JourneyLogEntry[]; history: HistoryPoint[] }
export interface JourneyModel {
  readonly hour: number; readonly status: 'paused' | 'running' | 'complete'; readonly speed: number; readonly activeScenario: ScenarioId; readonly config: JourneyConfig;
  advance(seconds: number): void; play(): void; pause(): void; setSpeed(value: number): void; seek(hour: number): void; stepHours(hours: number): void;
  reset(config?: Partial<JourneyConfig>): void; setHorizon(days: 14 | 21): void; setActiveScenario(id: ScenarioId): void;
  upsertEvent(event: ScenarioEvent): void; removeEvent(id: string): void; setEventEnabled(id: string, enabled: boolean): void;
  getSnapshot(scenarioId?: ScenarioId): JourneySnapshot; getComparison(): { A: JourneySnapshot; B: JourneySnapshot };
  getDiagnostics(): { snapshotsA: number; snapshotsB: number; simulatedSteps: number; cachedUntilA: number; cachedUntilB: number };
}
export interface AnatomyEntry { regionId: RegionId; name: string; shortName: string; bodyAnchor: Vec3; organAnchor: Vec3; tissueSceneId: string; connections: RegionId[]; description: string }
export interface JourneyRenderContext { snapshot: JourneySnapshot; level: AnatomyLevel; regionId: RegionId; selectedCellSlot: number | null; reducedMotion: boolean; autoCamera: boolean; playing: boolean; visualHour?: number }
export interface JourneyRendererInfo { backend: 'WebGPU' | 'WebGL 2'; fps: number; quality: string; geometries: number; textures: number; drawCalls: number; triangles: number; activeLevel: AnatomyLevel }
