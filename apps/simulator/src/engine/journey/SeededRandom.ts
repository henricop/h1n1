/** Snapshot-capable Mulberry32. Randomness is owned by each scenario, never by its renderer. */
export class JourneyRandom {
  constructor(public state: number) {}
  next(): number {
    let n = this.state = (this.state + 0x6D2B79F5) | 0;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  }
}
