export type Vec3 = { x: number; y: number; z: number };
export type CellState = 'healthy' | 'infected' | 'recovered';
export type VirusState = 'free' | 'attached' | 'neutralized';
export type SimulationStatus = 'running' | 'paused' | 'complete';
export interface Cell { id: number; position: Vec3; velocity: Vec3; age: number; radius: number; state: CellState; stateAge: number; infectionProgress: number; replicationProgress: number; infections: number }
export interface Virus { id: number; position: Vec3; velocity: Vec3; state: VirusState; age: number; attachedCellId: number | null; phase: number }
export interface ImmuneCell { id: number; position: Vec3; velocity: Vec3; age: number; state: 'patrolling' | 'pursuing' | 'engaging'; targetId: number | null; targetType: 'virus' | 'cell' | null; phase: number }
export interface SimulationConfig { seed: number; initialViruses: number; cellCount: number; immuneCount: number; defense: number; infectionRate: number; replicationBurst: number; replicationInterval: number; recoveryTime: number; adhesionTime: number; maxViruses: number; duration: number; bounds: Vec3 }
export interface SimulationMetrics { time: number; status: SimulationStatus; healthy: number; infected: number; recovered: number; activeViruses: number; attachedViruses: number; immuneAgents: number; neutralized: number; totalInfections: number; replications: number; peakInfected: number; finishReason: 'time' | 'contained' | null }
export interface SimulationEvent { id: number; type: 'infection' | 'replication' | 'neutralization' | 'recovery' | 'seed' | 'complete'; time: number; position: Vec3; cellId?: number; message: string }
export interface SimulationSnapshot { metrics: SimulationMetrics; events: SimulationEvent[]; config: SimulationConfig }
export interface Scenario { id: string; name: string; description: string; config: Partial<SimulationConfig> }
export interface SimulationModel { readonly cells: Cell[]; readonly viruses: Virus[]; readonly immuneCells: ImmuneCell[]; readonly config: SimulationConfig; readonly events: SimulationEvent[]; readonly time: number; readonly status: SimulationStatus; advance(realSeconds: number): void; play(): void; pause(): void; setSpeed(speed: number): void; setDefense(value: number): void; addViruses(count: number): void; reset(config?: Partial<SimulationConfig>): void; getSnapshot(): SimulationSnapshot }
