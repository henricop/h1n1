/**
 * Geometrias procedurais das peças (dependem de three; criadas uma vez com useMemo nos componentes).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!g) throw new Error('mergeGeometries falhou');
  return g;
}

/** Trímero de hemaglutinina: haste + cabeça de 3 lóbulos. */
export function haGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.03, 0.042, 0.3, 8, 1).translate(0, 0.15, 0)];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push(new THREE.SphereGeometry(0.072, 12, 10).translate(Math.cos(a) * 0.055, 0.35, Math.sin(a) * 0.055));
  }
  return merge(parts);
}

/** Tetrâmero de neuraminidase: haste fina + cabeça achatada de 4 lóbulos. */
export function naGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.022, 0.03, 0.38, 8, 1).translate(0, 0.19, 0)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(new THREE.SphereGeometry(0.068, 12, 8).scale(1, 0.55, 1).translate(Math.cos(a) * 0.064, 0.41, Math.sin(a) * 0.064));
  }
  return merge(parts);
}

/** Anticorpo em "Y": haste + dois braços. */
export function antibodyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6).translate(0, -0.075, 0),
    new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6).translate(0, 0.075, 0).rotateZ(0.65),
    new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6).translate(0, 0.075, 0).rotateZ(-0.65),
  ];
  return merge(parts);
}

/** Receptor com ácido siálico na célula: haste + cabecinha. */
export function receptorGeometry(): THREE.BufferGeometry {
  return merge([new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6).translate(0, 0.1, 0), new THREE.SphereGeometry(0.045, 10, 8).translate(0, 0.22, 0)]);
}
