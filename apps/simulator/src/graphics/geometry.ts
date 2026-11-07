import { BoxGeometry, BufferGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Fibonacci sampling gives each virion an evenly spiked silhouette at any angle. */
export function virusSurface(): { ha: BufferGeometry; na: BufferGeometry } {
  const ha: BufferGeometry[] = [];
  const na: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  const orient = new Quaternion();
  const matrix = new Matrix4();
  for (let i = 0; i < 28; i++) {
    const y = 1 - (i / 27) * 2;
    const radial = Math.sqrt(1 - y * y);
    const theta = i * Math.PI * (3 - Math.sqrt(5));
    const direction = new Vector3(Math.cos(theta) * radial, y, Math.sin(theta) * radial);
    orient.setFromUnitVectors(up, direction);
    const isNa = i % 6 === 0;
    const stalk = new CylinderGeometry(isNa ? 0.021 : 0.026, 0.022, isNa ? 0.16 : 0.12, 5);
    matrix.compose(direction.clone().multiplyScalar(isNa ? 0.34 : 0.32), orient, new Vector3(1, 1, 1));
    stalk.applyMatrix4(matrix);
    const head = isNa ? new BoxGeometry(0.108, 0.055, 0.108) : new IcosahedronGeometry(0.06, 0);
    matrix.compose(direction.clone().multiplyScalar(isNa ? 0.425 : 0.39), orient, new Vector3(1, 1, 1));
    head.applyMatrix4(matrix);
    (isNa ? na : ha).push(stalk, head);
  }
  // Polyhedra are non-indexed while stalks and boxes are indexed. Normalize before merging.
  const normalize = (geometries: BufferGeometry[]) => geometries.map((geometry) => {
    if (!geometry.index) return geometry;
    const normalized = geometry.toNonIndexed();
    geometry.dispose();
    return normalized;
  });
  const haParts = normalize(ha);
  const naParts = normalize(na);
  const haMerged = mergeGeometries(haParts, false)!;
  const naMerged = mergeGeometries(naParts, false)!;
  [...haParts, ...naParts].forEach((geometry) => geometry.dispose());
  return { ha: haMerged, na: naMerged };
}

/** A soft non-spherical membrane, shared by every cell (not a per-cell geometry). */
export function cellGeometry(): BufferGeometry {
  const geometry = new SphereGeometry(1, 24, 18);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i); const y = positions.getY(i); const z = positions.getZ(i);
    const bump = 1 + 0.035 * Math.sin(x * 7 + z * 3) * Math.sin(y * 6 - z * 2) + 0.025 * Math.cos(z * 8 + y * 3);
    positions.setXYZ(i, x * bump, y * bump, z * bump);
  }
  geometry.computeVertexNormals();
  return geometry;
}
