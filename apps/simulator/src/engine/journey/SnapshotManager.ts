const clone = <T>(value: T): T => structuredClone(value);
/** At most 85 six-hour snapshots for 21 days, independent of rendering/navigation frequency. */
export class SnapshotManager<T extends { hour: number }> {
  private cache = new Map<number, T>();
  constructor(initial: T) { this.cache.set(initial.hour, clone(initial)); }
  save(state: T): void { if (state.hour % 6 === 0) this.cache.set(state.hour, clone(state)); }
  nearest(hour: number): T {
    let chosen = 0;
    for (const key of this.cache.keys()) if (key <= hour && key > chosen) chosen = key;
    return clone(this.cache.get(chosen)!);
  }
  invalidateFrom(hour: number): void { for (const key of this.cache.keys()) if (key >= hour && key !== 0) this.cache.delete(key); }
  get size(): number { return this.cache.size; }
  get lastHour(): number { return Math.max(...this.cache.keys()); }
}
