import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, color, dot, float, mix, normalView, oneMinus, positionLocal, positionViewDirection, sin } from 'three/tsl';

/** TSL nodes compile to both WGSL and GLSL through WebGPURenderer. No raw backend-specific shader. */
export function cellMaterial(): MeshPhysicalNodeMaterial {
  const material = new MeshPhysicalNodeMaterial({ color: '#ffffff', roughness: 0.46, metalness: 0, clearcoat: 0.26, clearcoatRoughness: 0.5, transparent: true, opacity: 0.8, depthWrite: false });
  const rim = oneMinus(abs(dot(normalView, positionViewDirection))).pow(2.4);
  const grain = sin(positionLocal.x.mul(27)).mul(sin(positionLocal.y.mul(31))).mul(0.024);
  material.colorNode = mix(color('#a497b8'), color('#e8def1'), rim.mul(0.68).add(0.16)).add(grain);
  // The center admits the opaque nucleus/organelles; a denser edge reads as a membrane.
  material.opacityNode = mix(float(0.57), float(0.91), rim);
  material.roughnessNode = float(0.44).add(grain);
  return material;
}

export function virusMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ color: '#b94469', roughness: 0.4, metalness: 0.06 });
  const rim = oneMinus(abs(dot(normalView, positionViewDirection))).pow(2.0);
  material.colorNode = mix(color('#92314e'), color('#ed8c9f'), rim.mul(0.6).add(0.1));
  return material;
}

export function immuneMaterial(): MeshPhysicalNodeMaterial {
  const material = new MeshPhysicalNodeMaterial({ color: '#69bbaa', roughness: 0.43, metalness: 0.02, clearcoat: 0.28, transparent: true, opacity: 0.8, depthWrite: false });
  const rim = oneMinus(abs(dot(normalView, positionViewDirection))).pow(2.5);
  material.colorNode = mix(color('#3d8e80'), color('#c5ece1'), rim.mul(0.82).add(0.14));
  material.opacityNode = mix(float(0.65), float(0.93), rim);
  return material;
}

export function unlitMaterial(hex: string, opacity = 1): MeshBasicNodeMaterial {
  return new MeshBasicNodeMaterial({ color: hex, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
}
