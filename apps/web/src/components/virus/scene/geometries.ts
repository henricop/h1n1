/**
 * Geometrias procedurais das peças (dependem de three; criadas uma vez com useMemo nos componentes).
 * Proporções: docs/pesquisa/explicador-3d-virion.md. A forma do envelope vem de `envelopeRadius` (lib/virus/pose.ts),
 * a MESMA função que posiciona os espinhos — por isso eles não flutuam nem afundam.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '@/lib/virus/geometry';
import { HA_HEIGHT, M1_RADIUS, M2_HEIGHT, NA_HEIGHT, envelopeRadius, type Quality } from '@/lib/virus/pose';

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!g) throw new Error('mergeGeometries falhou');
  return g;
}

/** Cor por vértice uniforme (multiplica a cor da instância): permite haste mais escura que a cabeça. */
function tint(g: THREE.BufferGeometry, r: number, gr: number, b: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = r;
    arr[i * 3 + 1] = gr;
    arr[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Trímero de hemaglutinina: haste curta + cabeça alongada de 3 lóbulos (topo em HA_HEIGHT). Eixo +y. */
export function haGeometry(quality: Quality = 'high'): THREE.BufferGeometry {
  const hi = quality === 'high';
  const lobeR = 0.047;
  const lobeStretch = 1.55;
  const headY = HA_HEIGHT - lobeR * lobeStretch;
  const parts: THREE.BufferGeometry[] = [tint(new THREE.CylinderGeometry(0.028, 0.036, headY - 0.05, hi ? 8 : 6, 1, true).translate(0, (headY - 0.05) / 2, 0), 0.78, 0.82, 0.9)];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    parts.push(tint(new THREE.SphereGeometry(lobeR, hi ? 8 : 6, hi ? 6 : 5).scale(1, lobeStretch, 1).translate(Math.cos(a) * 0.036, headY, Math.sin(a) * 0.036), 1, 1, 1));
  }
  return merge(parts);
}

/** Tetrâmero de neuraminidase: haste fina e longa + cabeça quadrada achatada (topo em NA_HEIGHT, acima da HA). */
export function naGeometry(quality: Quality = 'high'): THREE.BufferGeometry {
  const hi = quality === 'high';
  const lobeR = 0.048;
  const flat = 0.62;
  const headY = NA_HEIGHT - lobeR * flat;
  const stemH = headY - 0.02;
  const parts: THREE.BufferGeometry[] = [tint(new THREE.CylinderGeometry(0.015, 0.02, stemH, hi ? 8 : 6, 1, true).translate(0, stemH / 2, 0), 0.8, 0.8, 0.86)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(tint(new THREE.SphereGeometry(lobeR, hi ? 8 : 6, hi ? 6 : 5).scale(1, flat, 1).translate(Math.cos(a) * 0.044, headY, Math.sin(a) * 0.044), 1, 1, 1));
  }
  return merge(parts);
}

/** Canal M2: cilindro pequeno e discreto (tetrâmero), topo em M2_HEIGHT. */
export function m2Geometry(quality: Quality = 'high'): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.026, 0.03, M2_HEIGHT, quality === 'high' ? 8 : 6, 1, false).translate(0, M2_HEIGHT / 2, 0);
}

/** Conta de nucleoproteína (esfera unitária; escala por instância). */
export function beadGeometry(quality: Quality = 'high'): THREE.BufferGeometry {
  return quality === 'high' ? new THREE.SphereGeometry(1, 8, 6) : new THREE.SphereGeometry(1, 6, 4);
}

export interface ShellHalves {
  top: THREE.BufferGeometry;
  bottom: THREE.BufferGeometry;
}

/**
 * Casca esférica deslocada por `envelopeRadius` (uma vez, na CPU), normais calculadas na esfera inteira e depois
 * dividida em duas metades pelo sinal de y (mesma costura, mesmas normais). `holes` remove triângulos (lacunas).
 */
function shellHalves(scale: number, widthSeg: number, heightSeg: number, holes: ReadonlyArray<{ dir: Vec3; radius: number }> = []): ShellHalves {
  const sphere = new THREE.SphereGeometry(1, widthSeg, heightSeg);
  sphere.deleteAttribute('uv');
  const g = mergeVertices(sphere);
  sphere.dispose();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const d: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    d.x = x / l;
    d.y = y / l;
    d.z = z / l;
    const r = envelopeRadius(d) * scale;
    pos.setXYZ(i, d.x * r, d.y * r, d.z * r);
  }
  g.computeVertexNormals();
  const index = g.getIndex();
  if (!index) throw new Error('shellHalves: geometria sem índice');
  const topIdx: number[] = [];
  const botIdx: number[] = [];
  const cos = holes.map((h) => Math.cos(h.radius));
  const hdirs = holes.map((h) => {
    const l = Math.hypot(h.dir.x, h.dir.y, h.dir.z) || 1;
    return { x: h.dir.x / l, y: h.dir.y / l, z: h.dir.z / l };
  });
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const l = Math.hypot(cx, cy, cz) || 1;
    let skip = false;
    for (let h = 0; h < hdirs.length && !skip; h++) {
      const hd = hdirs[h]!;
      if ((cx * hd.x + cy * hd.y + cz * hd.z) / l > cos[h]!) skip = true;
    }
    if (skip) continue;
    (cy >= 0 ? topIdx : botIdx).push(a, b, c);
  }
  const make = (idx: number[]) => {
    const h = new THREE.BufferGeometry();
    h.setAttribute('position', pos);
    h.setAttribute('normal', g.getAttribute('normal'));
    h.setIndex(idx);
    h.computeBoundingSphere();
    return h;
  };
  return { top: make(topIdx), bottom: make(botIdx) };
}

/** Envelope pleomórfico em duas metades (64×32 em 'high'; heightSegments par → anel exato no equador). */
export function envelopeHalves(quality: Quality = 'high'): ShellHalves {
  return quality === 'high' ? shellHalves(1, 64, 32) : shellHalves(1, 48, 24);
}

/** Lacunas sutis da monocamada M1 (≈ 20 % dos vírions têm falhas; aqui 3 pequenas). */
const M1_HOLES: ReadonlyArray<{ dir: Vec3; radius: number }> = [
  { dir: { x: 0.53, y: 0.3, z: 0.79 }, radius: 0.2 },
  { dir: { x: -0.7, y: -0.5, z: -0.5 }, radius: 0.17 },
  { dir: { x: -0.2, y: 0.75, z: -0.63 }, radius: 0.15 },
];

/** Camada M1 (opaca, fosca) logo abaixo do envelope, mesma forma pleomórfica, com 3 lacunas sutis. */
export function matrixHalves(quality: Quality = 'high'): ShellHalves {
  return quality === 'high' ? shellHalves(M1_RADIUS, 48, 24, M1_HOLES) : shellHalves(M1_RADIUS, 32, 16, M1_HOLES);
}

/** Anel fino na costura (equador) do envelope, seguindo o raio pleomórfico. */
export function seamGeometry(quality: Quality = 'high'): THREE.BufferGeometry {
  const n = 64;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = { x: Math.cos(a), y: 0, z: Math.sin(a) };
    const r = envelopeRadius(d);
    pts.push(new THREE.Vector3(d.x * r, 0, d.z * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, quality === 'high' ? 96 : 64, 0.007, 5, true);
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
