import { clamp } from './config';
/** One-hour ticks; playback speed only changes tick scheduling, not model coefficients. */
export class SimulationClock {
  hour = 0;
  speed = 1;
  status: 'paused' | 'running' | 'complete' = 'paused';
  private fraction = 0;
  constructor(public maxHour: number) {}
  get visualHour(): number { return this.hour + this.fraction; }
  reset(maxHour = this.maxHour): void { this.maxHour = maxHour; this.hour = this.fraction = 0; this.speed = 1; this.status = 'paused'; }
  seek(hour: number): void {
    if (!Number.isFinite(hour)) return;
    this.hour = Math.round(clamp(hour, 0, this.maxHour)); this.fraction = 0;
    this.status = this.hour >= this.maxHour ? 'complete' : 'paused';
  }
  advance(seconds: number, onHour: (hour: number) => void): void {
    if (this.status !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return;
    this.fraction += seconds * 2 * this.speed;
    while (this.fraction + 1e-10 >= 1 && this.hour < this.maxHour) {
      this.fraction = Math.max(0, this.fraction - 1); onHour(this.hour + 1); this.hour++;
    }
    if (this.hour >= this.maxHour) { this.status = 'complete'; this.fraction = 0; }
  }
  setSpeed(value: number): void { if (Number.isFinite(value)) this.speed = clamp(value, .25, 10); }
  play(): void { if (this.hour < this.maxHour) this.status = 'running'; }
  pause(): void { if (this.status === 'running') this.status = 'paused'; }
}
