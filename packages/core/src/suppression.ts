import type { Observation, PublishedObservation } from './types.js';

export interface SuppressionOptions {
  /** células com value < threshold são suprimidas (0 = desativado) */
  threshold: number;
  /** nunca suprimir totais nacionais sem estrato */
  exemptNationalTotals?: boolean;
  /** aplica supressão complementar: se só uma célula do grupo foi suprimida e há total, suprime a próxima menor */
  complementary?: boolean;
}

function groupKey(o: Observation): string {
  return [o.indicator_id, o.snapshot_id, o.geo_level, o.geo_code, o.period_type, o.period].join('|');
}

export function stratumKey(stratum: Record<string, string>): string {
  return Object.keys(stratum)
    .sort()
    .map((k) => `${k}=${stratum[k]}`)
    .join(';');
}

/**
 * Supressão de célula pequena aplicada na camada de publicação (regra 9 da seção 10.4).
 * O valor bruto nunca sai: células suprimidas saem com value = null e suppressed = true.
 */
export function applySuppression(rows: Observation[], opts: SuppressionOptions): PublishedObservation[] {
  const { threshold, exemptNationalTotals = true, complementary = true } = opts;
  const out: PublishedObservation[] = rows.map((r) => ({ ...r, suppressed: false }));
  if (threshold <= 0) return out;

  const isExempt = (o: Observation) =>
    exemptNationalTotals && o.geo_level === 'country' && Object.keys(o.stratum).length === 0;

  for (const o of out) {
    if (isExempt(o)) continue;
    if (o.value !== null && o.value > 0 && o.value < threshold) {
      o.value = null;
      o.suppressed = true;
    }
  }

  if (!complementary) return out;

  // Supressão complementar por grupo (mesma geo/período, estratos diferentes)
  const groups = new Map<string, PublishedObservation[]>();
  for (const o of out) {
    const k = groupKey(o);
    const arr = groups.get(k);
    if (arr) arr.push(o);
    else groups.set(k, [o]);
  }
  for (const cells of groups.values()) {
    const total = cells.find((c) => Object.keys(c.stratum).length === 0);
    const strata = cells.filter((c) => Object.keys(c.stratum).length > 0);
    if (!total || total.value === null) continue;
    const suppressed = strata.filter((c) => c.suppressed);
    if (suppressed.length !== 1) continue;
    const candidates = strata.filter((c) => !c.suppressed && c.value !== null).sort((a, b) => a.value! - b.value!);
    const next = candidates[0];
    if (next) {
      next.value = null;
      next.suppressed = true;
    }
  }
  return out;
}
