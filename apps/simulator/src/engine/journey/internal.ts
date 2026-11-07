import type { BodyState, HistoryPoint, JourneyLogEntry, RegionState } from '../../journey/types';
import { SnapshotManager } from './SnapshotManager';
export interface InternalRegion extends RegionState { viralPool: number; immuneMemory: number; everInfected: number }
export interface InternalWorld { hour: number; randomState: number; regions: InternalRegion[]; body: BodyState; log: JourneyLogEntry[]; history: HistoryPoint[] }
export interface ScenarioBranch { state: InternalWorld; snapshots: SnapshotManager<InternalWorld> }
