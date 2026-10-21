import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCatalog } from '../src/catalog.js';
import { INDICATORS, INDICATOR_BY_ID } from '../src/indicators.js';

describe('catálogo', () => {
  it('carrega as 65 fontes com slugs únicos', () => {
    const json = JSON.parse(readFileSync(new URL('../../../data/sources.json', import.meta.url), 'utf8'));
    const sources = parseCatalog(json);
    expect(sources).toHaveLength(65);
    expect(new Set(sources.map((s) => s.slug)).size).toBe(65);
    expect(sources.filter((s) => s.priority === 'P0')).toHaveLength(19);
    expect(sources.find((s) => s.id === 'INT-01')?.mirror_group).toBe('who_flu');
  });
  it('indicadores apontam para fontes existentes e denominadores válidos', () => {
    const json = JSON.parse(readFileSync(new URL('../../../data/sources.json', import.meta.url), 'utf8'));
    const ids = new Set(parseCatalog(json).map((s) => s.id));
    for (const ind of INDICATORS) {
      expect(ids.has(ind.source_id), ind.id).toBe(true);
      expect(ind.universe_note.length).toBeGreaterThan(20);
      if (ind.denominator_indicator_id) expect(INDICATOR_BY_ID.has(ind.denominator_indicator_id)).toBe(true);
    }
  });
});
