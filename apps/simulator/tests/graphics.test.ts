import { describe, expect, it } from 'vitest';
import { Color } from 'three/webgpu';
import { cellGeometry, virusSurface } from '../src/graphics/geometry';
import { cellMaterial, immuneMaterial, virusMaterial } from '../src/graphics/materials';

// Pure geometry/material tests complement GPU browser QA; they do not claim to render either backend.
describe('shared microscope geometry', () => {
  it('merges indexed stalks and non-indexed HA/NA heads into finite, nonempty geometry', () => {
    const { ha, na } = virusSurface();
    for (const geometry of [ha, na]) {
      expect(geometry.attributes.position!.count).toBeGreaterThan(100);
      expect(Array.from(geometry.attributes.position!.array).every(Number.isFinite)).toBe(true);
      expect(geometry.attributes.normal!.count).toBe(geometry.attributes.position!.count);
      geometry.computeBoundingSphere();
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0.35);
      expect(geometry.boundingSphere!.radius).toBeLessThan(0.55);
      geometry.dispose();
    }
  });
  it('keeps every organic cell vertex close to the logical unit collision surface', () => {
    const geometry = cellGeometry();
    const vertices = geometry.attributes.position!;
    for (let i = 0; i < vertices.count; i++) {
      const radius = Math.hypot(vertices.getX(i), vertices.getY(i), vertices.getZ(i));
      expect(radius).toBeGreaterThan(0.93);
      expect(radius).toBeLessThan(1.07);
    }
    geometry.dispose();
  });
  it('produces repeatable geometry without consuming engine randomness', () => {
    const a = cellGeometry(); const b = cellGeometry();
    expect(Array.from(a.attributes.position!.array)).toEqual(Array.from(b.attributes.position!.array));
    a.dispose(); b.dispose();
  });
});

describe('backend-common TSL materials', () => {
  it('uses serializable node graphs rather than GLSL-only ShaderMaterial effects', () => {
    const materials = [cellMaterial(), virusMaterial(), immuneMaterial()];
    for (const material of materials) {
      expect(material.isNodeMaterial).toBe(true);
      expect(material.colorNode).not.toBeNull();
      // Color graphs serialize without renderer globals or texture/network resources.
      const json = material.toJSON();
      expect(json).toHaveProperty('inputNodes.colorNode');
      expect(() => JSON.stringify(json)).not.toThrow();
      expect(material.color).toBeInstanceOf(Color);
      material.dispose();
    }
  });
});
