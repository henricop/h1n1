'use client';
/**
 * Vírion A(H1N1) procedural em react-three-fiber: envelope translúcido, ~90 trímeros de hemaglutinina,
 * ~16 tetrâmeros de neuraminidase, canais M2, camada M1 e 8 RNPs. O estado da cena (explode, câmera,
 * célula, gotículas, anticorpos) é lido a cada quadro de `progress` (MotionValue) ou de `chapterOverride`
 * e suavizado por lerp; `frameloop="demand"` + invalidate só enquanto algo se move.
 * Carregado com next/dynamic (ssr: false); o pôster SVG cobre o carregamento e o fallback.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Html, useCursor } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCENE_KEYS, sceneState, sceneStateFromProgress, type SceneState } from '@/lib/virus/chapters';
import { RNA_SEGMENTS, fibonacciSphere, helixPoints, seededRandom, type Vec3 } from '@/lib/virus/geometry';
import { PART_BY_ID, PART_COLORS, type PartId } from '@/lib/virus/parts';

export interface VirusCanvasProps {
  /** progresso contínuo [0, 5) vindo da rolagem */
  progress: MotionValue<number>;
  /** capítulo fixo (reduced-motion / botões); null = seguir `progress` */
  chapterOverride: number | null;
  reducedMotion: boolean;
  quality: 'low' | 'high';
  hovered: PartId | null;
  selected: PartId | null;
  onHover: (p: PartId | null) => void;
  onSelect: (p: PartId) => void;
  onReady?: () => void;
}

type StateRef = MutableRefObject<SceneState>;

const R_ENV = 1;
const UP = new THREE.Vector3(0, 1, 0);
const CELL_CENTER = new THREE.Vector3(3.3, 0, 0);
const CELL_RADIUS = 2.2;
const PERSON_X = 2.8;
const MOUTH_Y = 0.95;

const COUNTS = {
  high: { ha: 90, na: 16, m2: 8, antibodies: 36, droplets: 80, receptors: 44 },
  low: { ha: 50, na: 10, m2: 6, antibodies: 20, droplets: 44, receptors: 24 },
} as const;

// ---------- geometrias procedurais (useMemo nos componentes) ----------
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!g) throw new Error('mergeGeometries falhou');
  return g;
}

/** Trímero de hemaglutinina: haste + cabeça de 3 lóbulos. */
function haGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.03, 0.042, 0.3, 8, 1).translate(0, 0.15, 0)];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push(new THREE.SphereGeometry(0.072, 12, 10).translate(Math.cos(a) * 0.055, 0.35, Math.sin(a) * 0.055));
  }
  return merge(parts);
}

/** Tetrâmero de neuraminidase: haste fina + cabeça achatada de 4 lóbulos. */
function naGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.022, 0.03, 0.38, 8, 1).translate(0, 0.19, 0)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(new THREE.SphereGeometry(0.068, 12, 8).scale(1, 0.55, 1).translate(Math.cos(a) * 0.064, 0.41, Math.sin(a) * 0.064));
  }
  return merge(parts);
}

/** Anticorpo em "Y": haste + dois braços. */
function antibodyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6).translate(0, -0.075, 0),
    new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6).translate(0, 0.075, 0).rotateZ(0.65),
    new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6).translate(0, 0.075, 0).rotateZ(-0.65),
  ];
  return merge(parts);
}

/** Receptor com ácido siálico na célula: haste + cabecinha. */
function receptorGeometry(): THREE.BufferGeometry {
  return merge([new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6).translate(0, 0.1, 0), new THREE.SphereGeometry(0.045, 10, 8).translate(0, 0.22, 0)]);
}

function toVector(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

function closestDir(dirs: readonly Vec3[], target: Vec3): number {
  let best = 0;
  let bestDot = -Infinity;
  dirs.forEach((d, i) => {
    const dot = d.x * target.x + d.y * target.y + d.z * target.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  });
  return best;
}

// ---------- cena ----------
function Scene(props: VirusCanvasProps) {
  const { invalidate, camera } = useThree();
  const stateRef = useRef<SceneState>({ ...sceneState(0, 0) });
  const spin = useRef(0);
  const virusGroup = useRef<THREE.Group>(null);
  const labelsRef = useRef(false);
  const contactRef = useRef(false);
  const [labelsOn, setLabelsOn] = useState(false);
  const [contact, setContact] = useState(false);
  const { progress, chapterOverride, reducedMotion, onReady } = props;

  useEffect(() => progress.on('change', () => invalidate()), [progress, invalidate]);
  useEffect(() => {
    invalidate();
  }, [chapterOverride, props.hovered, props.selected, invalidate]);
  useEffect(() => {
    onReady?.();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = chapterOverride !== null ? sceneState(chapterOverride, 1) : sceneStateFromProgress(progress.get());
    const cur = stateRef.current;
    const k = reducedMotion ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 7);
    let moving = false;
    for (const key of SCENE_KEYS) {
      const diff = target[key] - cur[key];
      if (Math.abs(diff) > 0.0006) {
        cur[key] += diff * k;
        moving = true;
      } else {
        cur[key] = target[key];
      }
    }
    if (!reducedMotion && cur.spin > 0.01) {
      spin.current += dt * 0.22 * cur.spin;
      moving = true;
    }
    const g = virusGroup.current;
    if (g) {
      g.rotation.y = spin.current;
      g.position.set(cur.virusX, cur.virusY, 0);
      g.scale.setScalar(cur.virusScale);
    }
    camera.position.set(cur.cameraX, cur.cameraY, cur.cameraZ);
    camera.lookAt(cur.cameraX * 0.55, 0.05, 0);
    const lab = cur.labels > 0.5;
    if (lab !== labelsRef.current) {
      labelsRef.current = lab;
      setLabelsOn(lab);
    }
    const c = cur.approach > 0.9;
    if (c !== contactRef.current) {
      contactRef.current = c;
      setContact(c);
    }
    if (moving) invalidate();
  });

  const counts = COUNTS[props.quality];
  const haDirs = useMemo(() => fibonacciSphere(counts.ha), [counts.ha]);
  const naDirs = useMemo(() => fibonacciSphere(counts.na).map((d) => rotateY(d, 0.9)), [counts.na]);
  const m2Dirs = useMemo(() => fibonacciSphere(counts.m2).map((d) => rotateY(d, 2.1)), [counts.m2]);

  const isActive = (id: PartId) => props.hovered === id || props.selected === id;
  const pointer = {
    over: (id: PartId) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      props.onHover(id);
    },
    out: () => props.onHover(null),
    click: (id: PartId) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      props.onSelect(id);
    },
  };

  return (
    <>
      <hemisphereLight args={['#ffffff', '#dfe6f2', 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.7} />
      <directionalLight position={[-4, 2, -3]} intensity={0.55} color="#dbe5ff" />
      <ambientLight intensity={0.3} />

      <group ref={virusGroup}>
        <Envelope stateRef={stateRef} active={isActive('envelope')} onOver={pointer.over('envelope')} onOut={pointer.out} onClick={pointer.click('envelope')} />
        <Matrix stateRef={stateRef} active={isActive('m1')} onOver={pointer.over('m1')} onOut={pointer.out} onClick={pointer.click('m1')} />
        <Spikes
          kind="ha"
          dirs={haDirs}
          stateRef={stateRef}
          active={isActive('ha') || contact}
          onOver={pointer.over('ha')}
          onOut={pointer.out}
          onClick={pointer.click('ha')}
        />
        <Spikes kind="na" dirs={naDirs} stateRef={stateRef} active={isActive('na')} onOver={pointer.over('na')} onOut={pointer.out} onClick={pointer.click('na')} />
        <Channels dirs={m2Dirs} stateRef={stateRef} active={isActive('m2')} onOver={pointer.over('m2')} onOut={pointer.out} onClick={pointer.click('m2')} />
        <Rnps stateRef={stateRef} active={isActive('rna')} onOver={pointer.over('rna')} onOut={pointer.out} onClick={pointer.click('rna')} />
        <Antibodies haDirs={haDirs} count={counts.antibodies} stateRef={stateRef} />
        <Labels stateRef={stateRef} haDirs={haDirs} naDirs={naDirs} m2Dirs={m2Dirs} labelsOn={labelsOn} hovered={props.hovered} selected={props.selected} onSelect={props.onSelect} />
      </group>

      <Cell stateRef={stateRef} receptors={counts.receptors} />
      <People stateRef={stateRef} />
      <Droplets stateRef={stateRef} count={counts.droplets} />

      {props.quality === 'high' && <ContactShadows position={[0, -1.95, 0]} opacity={0.22} scale={10} blur={2.6} far={3.2} color={PART_COLORS.ink} />}
    </>
  );
}

function rotateY(d: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: d.x * c + d.z * s, y: d.y, z: -d.x * s + d.z * c };
}

interface PartProps {
  stateRef: StateRef;
  active: boolean;
  onOver: (e: ThreeEvent<PointerEvent>) => void;
  onOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

/** Envelope lipídico em dois hemisférios, que se afastam no explode. */
function Envelope({ stateRef, active, onOver, onOut, onClick }: PartProps) {
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useFrame(() => {
    const e = stateRef.current.explode;
    if (top.current) {
      top.current.position.y = e * 0.78;
      top.current.rotation.x = -e * 0.22;
    }
    if (bottom.current) {
      bottom.current.position.y = -e * 0.78;
      bottom.current.rotation.x = e * 0.22;
    }
  });
  const mat = (
    <meshPhysicalMaterial
      color={PART_COLORS.envelope}
      roughness={0.55}
      metalness={0}
      clearcoat={0.35}
      clearcoatRoughness={0.5}
      sheen={0.4}
      sheenColor="#ffffff"
      transparent
      opacity={0.72}
      depthWrite={false}
      side={THREE.DoubleSide}
      emissive={PART_COLORS.primary}
      emissiveIntensity={active ? 0.12 : 0}
    />
  );
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      setHover(true);
      onOver(e);
    },
    onPointerOut: () => {
      setHover(false);
      onOut();
    },
    onClick,
  };
  return (
    <>
      <mesh ref={top} {...handlers}>
        <sphereGeometry args={[R_ENV, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh ref={bottom} {...handlers}>
        <sphereGeometry args={[R_ENV, 56, 28, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {mat}
      </mesh>
    </>
  );
}

/** Camada M1: dois hemisférios foscos logo abaixo do envelope. */
function Matrix({ stateRef, active, onOver, onOut, onClick }: PartProps) {
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useFrame(() => {
    const e = stateRef.current.explode;
    if (top.current) top.current.position.y = e * 0.34;
    if (bottom.current) bottom.current.position.y = -e * 0.34;
  });
  const mat = <meshStandardMaterial color={PART_COLORS.m1} roughness={0.95} transparent opacity={0.9} side={THREE.DoubleSide} emissive={PART_COLORS.primary} emissiveIntensity={active ? 0.18 : 0} />;
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      setHover(true);
      onOver(e);
    },
    onPointerOut: () => {
      setHover(false);
      onOut();
    },
    onClick,
  };
  return (
    <>
      <mesh ref={top} {...handlers}>
        <sphereGeometry args={[0.86, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh ref={bottom} {...handlers}>
        <sphereGeometry args={[0.86, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {mat}
      </mesh>
    </>
  );
}

/** Espinhos instanciados (HA azul ou NA rosa) distribuídos pela esfera de Fibonacci. */
function Spikes({ kind, dirs, stateRef, active, onOver, onOut, onClick }: PartProps & { kind: 'ha' | 'na'; dirs: readonly Vec3[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => (kind === 'ha' ? haGeometry() : naGeometry()), [kind]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const applied = useRef(-1);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useEffect(() => () => geom.dispose(), [geom]);
  useFrame(() => {
    const e = stateRef.current.explode;
    const m = mesh.current;
    if (!m || Math.abs(e - applied.current) < 1e-4) return;
    applied.current = e;
    dirs.forEach((d, i) => {
      tmp.set(d.x, d.y, d.z);
      const r = kind === 'ha' ? R_ENV - 0.02 + e * 0.8 : R_ENV - 0.02 + e * 0.95;
      dummy.position.copy(tmp).multiplyScalar(r);
      if (kind === 'ha') dummy.position.y += e * 0.35;
      else {
        dummy.position.y -= e * 0.3;
        dummy.position.x -= e * 0.35;
      }
      dummy.quaternion.setFromUnitVectors(UP, tmp);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  const color = kind === 'ha' ? PART_COLORS.primary : PART_COLORS.h1n1;
  return (
    <instancedMesh
      ref={mesh}
      frustumCulled={false}
      args={[geom, undefined, dirs.length]}
      onPointerOver={(e) => {
        setHover(true);
        onOver(e);
      }}
      onPointerOut={() => {
        setHover(false);
        onOut();
      }}
      onClick={onClick}
    >
      <meshStandardMaterial color={color} roughness={0.48} metalness={0.05} emissive={color} emissiveIntensity={active ? 0.45 : 0} />
    </instancedMesh>
  );
}

/** Canais M2: pequenos cilindros cinza. */
function Channels({ dirs, stateRef, active, onOver, onOut, onClick }: PartProps & { dirs: readonly Vec3[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const applied = useRef(-1);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useFrame(() => {
    const e = stateRef.current.explode;
    const m = mesh.current;
    if (!m || Math.abs(e - applied.current) < 1e-4) return;
    applied.current = e;
    dirs.forEach((d, i) => {
      tmp.set(d.x, d.y, d.z);
      dummy.position.copy(tmp).multiplyScalar(R_ENV + 0.03 + e * 0.55);
      dummy.position.x += e * 0.3;
      dummy.quaternion.setFromUnitVectors(UP, tmp);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      frustumCulled={false}
      args={[undefined, undefined, dirs.length]}
      onPointerOver={(e) => {
        setHover(true);
        onOver(e);
      }}
      onPointerOut={() => {
        setHover(false);
        onOut();
      }}
      onClick={onClick}
    >
      <cylinderGeometry args={[0.034, 0.034, 0.2, 8]} />
      <meshStandardMaterial color={PART_COLORS.m2} roughness={0.7} emissive={PART_COLORS.primary} emissiveIntensity={active ? 0.5 : 0} />
    </instancedMesh>
  );
}

/** 8 ribonucleoproteínas (hélices), arranjo 7+1 por dentro; em leque no explode. */
function Rnps({ stateRef, active, onOver, onOut, onClick }: PartProps) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const items = useMemo(
    () =>
      RNA_SEGMENTS.map((seg, k) => {
        const len = 1.2 * seg.relLength + 0.15;
        const pts = helixPoints(2.6 * seg.relLength + 1.2, 0.07, len, 56, k * 0.8).map(toVector);
        const curve = new THREE.CatmullRomCurve3(pts);
        const geometry = new THREE.TubeGeometry(curve, 72, 0.032, 7, false);
        const inner = k === 0 ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(Math.cos(((k - 1) / 7) * Math.PI * 2) * 0.42, 0, Math.sin(((k - 1) / 7) * Math.PI * 2) * 0.42);
        const outer = new THREE.Vector3((k - 3.5) * 0.4, -0.1, 1.45);
        const color = k % 2 === 0 ? PART_COLORS.infb : PART_COLORS.h3;
        return { geometry, inner, outer, color, tilt: (k - 3.5) * 0.11 };
      }),
    [],
  );
  useEffect(() => () => items.forEach((i) => i.geometry.dispose()), [items]);
  useFrame(() => {
    const e = stateRef.current.explode;
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, k) => {
      const it = items[k];
      if (!it) return;
      child.position.lerpVectors(it.inner, it.outer, e);
      child.rotation.z = it.tilt * e;
    });
  });
  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        setHover(true);
        onOver(e);
      }}
      onPointerOut={() => {
        setHover(false);
        onOut();
      }}
      onClick={onClick}
    >
      {items.map((it, k) => (
        <mesh key={k} geometry={it.geometry} position={it.inner}>
          <meshStandardMaterial color={it.color} roughness={0.5} emissive={it.color} emissiveIntensity={active ? 0.4 : 0} />
        </mesh>
      ))}
    </group>
  );
}

/** Anticorpos em "Y" (verde) que chegam de fora e grudam nas cabeças de hemaglutinina. */
function Antibodies({ haDirs, count, stateRef }: { haDirs: readonly Vec3[]; count: number; stateRef: StateRef }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => antibodyGeometry(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const applied = useRef(-1);
  const items = useMemo(() => {
    const rnd = seededRandom(7);
    const step = Math.max(1, Math.floor(haDirs.length / count));
    return Array.from({ length: count }, (_, i) => {
      const d = haDirs[(i * step) % haDirs.length]!;
      const dir = toVector(d);
      const rv = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
      const tangent = rv.sub(dir.clone().multiplyScalar(dir.dot(rv))).normalize();
      const start = dir.clone().multiplyScalar(R_ENV + 2.3).add(tangent.multiplyScalar(0.9 * rnd()));
      const end = dir.clone().multiplyScalar(R_ENV + 0.46);
      return { dir, start, end, delay: rnd() * 0.55, roll: rnd() * Math.PI * 2 };
    });
  }, [haDirs, count]);
  useEffect(() => () => geom.dispose(), [geom]);
  useFrame(() => {
    const a = stateRef.current.antibodies;
    const m = mesh.current;
    if (!m) return;
    m.visible = a > 0.01;
    if (Math.abs(a - applied.current) < 1e-4) return;
    applied.current = a;
    items.forEach((it, i) => {
      const t = smooth((a - it.delay) / 0.45);
      dummy.position.lerpVectors(it.start, it.end, t);
      dummy.quaternion.setFromUnitVectors(UP, it.dir.clone().negate());
      dummy.rotateY(it.roll);
      dummy.scale.setScalar(a < 0.01 ? 0.0001 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} frustumCulled={false} args={[geom, undefined, count]} visible={false}>
      <meshStandardMaterial color={PART_COLORS.ok} roughness={0.5} />
    </instancedMesh>
  );
}

function smooth(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

/** Célula-alvo (capítulo 3): esfera grande translúcida com receptores voltados para o vírus. */
function Cell({ stateRef, receptors }: { stateRef: StateRef; receptors: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const recMat = useRef<THREE.MeshStandardMaterial>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => receptorGeometry(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dirs = useMemo(() => fibonacciSphere(receptors * 5).filter((d) => d.x < -0.55).slice(0, receptors), [receptors]);
  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => {
    const m = inst.current;
    if (!m) return;
    dirs.forEach((d, i) => {
      const v = toVector(d);
      dummy.position.copy(v).multiplyScalar(CELL_RADIUS);
      dummy.quaternion.setFromUnitVectors(UP, v);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [dirs, dummy]);
  useFrame(() => {
    const c = stateRef.current.cell;
    if (group.current) group.current.visible = c > 0.01;
    if (mat.current) mat.current.opacity = 0.82 * c;
    if (recMat.current) recMat.current.opacity = c;
  });
  return (
    <group ref={group} position={CELL_CENTER} visible={false}>
      <mesh>
        <sphereGeometry args={[CELL_RADIUS, 64, 40]} />
        <meshPhysicalMaterial ref={mat} color={PART_COLORS.cell} roughness={0.7} clearcoat={0.2} transparent opacity={0} depthWrite={false} />
      </mesh>
      <instancedMesh ref={inst} frustumCulled={false} args={[geom, undefined, dirs.length]}>
        <meshStandardMaterial ref={recMat} color="#7b96e8" roughness={0.6} transparent opacity={0} />
      </instancedMesh>
    </group>
  );
}

/** Duas silhuetas (capítulo 4). */
function People({ stateRef }: { stateRef: StateRef }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    const p = stateRef.current.people;
    if (group.current) group.current.visible = p > 0.01;
    mats.current.forEach((m) => {
      m.opacity = 0.95 * p;
    });
  });
  const setMat = (m: THREE.MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m);
  };
  const person = (x: number, flip: boolean) => (
    <group position={[x, 0, 0]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.42, 28, 20]} />
        <meshStandardMaterial ref={setMat} color={PART_COLORS.person} roughness={0.9} transparent opacity={0} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <capsuleGeometry args={[0.6, 1.1, 6, 14]} />
        <meshStandardMaterial ref={setMat} color={PART_COLORS.person} roughness={0.9} transparent opacity={0} />
      </mesh>
    </group>
  );
  return (
    <group ref={group} visible={false}>
      {person(-PERSON_X, false)}
      {person(PERSON_X, true)}
    </group>
  );
}

/** Gotículas que saem de uma silhueta e alcançam a outra. */
function Droplets({ stateRef, count }: { stateRef: StateRef; count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const applied = useRef(-1);
  const items = useMemo(() => {
    const rnd = seededRandom(11);
    return Array.from({ length: count }, () => ({ delay: rnd() * 0.6, arc: 0.25 + rnd() * 0.9, z: (rnd() - 0.5) * 1.1, y: (rnd() - 0.5) * 0.3, size: 0.03 + rnd() * 0.055, droop: rnd() * 0.9 }));
  }, [count]);
  useFrame(() => {
    const d = stateRef.current.droplets;
    const m = mesh.current;
    if (!m) return;
    m.visible = d > 0.01;
    if (Math.abs(d - applied.current) < 1e-4) return;
    applied.current = d;
    const x0 = -PERSON_X + 0.5;
    const x1 = PERSON_X - 0.5;
    items.forEach((it, i) => {
      const t = smooth((d * 1.55 - it.delay) / 0.95);
      const x = x0 + (x1 - x0) * t;
      const y = MOUTH_Y + it.y + it.arc * 4 * t * (1 - t) - it.droop * t * t;
      dummy.position.set(x, y, it.z * t);
      dummy.scale.setScalar(d < 0.01 ? 0.0001 : it.size * (0.6 + 0.4 * (1 - t)));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} frustumCulled={false} args={[undefined, undefined, count]} visible={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color={PART_COLORS.droplet} roughness={0.3} transparent opacity={0.85} />
    </instancedMesh>
  );
}

// ---------- rótulos (drei Html) ----------
const LABEL_IDS: readonly PartId[] = ['ha', 'na', 'rna', 'envelope', 'm1', 'm2'];

function Labels({
  stateRef,
  haDirs,
  naDirs,
  m2Dirs,
  labelsOn,
  hovered,
  selected,
  onSelect,
}: {
  stateRef: StateRef;
  haDirs: readonly Vec3[];
  naDirs: readonly Vec3[];
  m2Dirs: readonly Vec3[];
  labelsOn: boolean;
  hovered: PartId | null;
  selected: PartId | null;
  onSelect: (p: PartId) => void;
}) {
  const refs = useRef<Record<PartId, THREE.Group | null>>({ ha: null, na: null, rna: null, envelope: null, m1: null, m2: null });
  const anchors = useMemo(() => {
    const ha = toVector(haDirs[closestDir(haDirs, { x: -0.55, y: 0.6, z: 0.55 })]!);
    const na = toVector(naDirs[closestDir(naDirs, { x: 0.7, y: -0.35, z: 0.6 })]!);
    const m2 = toVector(m2Dirs[closestDir(m2Dirs, { x: 0.6, y: 0.5, z: 0.6 })]!);
    return { ha, na, m2 };
  }, [haDirs, naDirs, m2Dirs]);
  useFrame(() => {
    const e = stateRef.current.explode;
    const r = refs.current;
    r.ha?.position.copy(anchors.ha).multiplyScalar(R_ENV + 0.5 + e * 0.8).setY(anchors.ha.y * (R_ENV + 0.5 + e * 0.8) + e * 0.35);
    r.na?.position.copy(anchors.na).multiplyScalar(R_ENV + 0.55 + e * 0.95).add(new THREE.Vector3(-e * 0.35, -e * 0.3, 0));
    r.rna?.position.set(0, -0.75, 0.4 + e * 1.25);
    r.envelope?.position.set(0, R_ENV + 0.12 + e * 0.78, 0);
    r.m1?.position.set(-0.55, e * 0.34 + 0.2, 0.7);
    r.m2?.position.copy(anchors.m2).multiplyScalar(R_ENV + 0.2 + e * 0.55).add(new THREE.Vector3(e * 0.3, 0, 0));
  });
  return (
    <>
      {LABEL_IDS.map((id) => {
        const part = PART_BY_ID.get(id)!;
        const forced = hovered === id || selected === id;
        const show = forced || (labelsOn && (id === 'ha' || id === 'na' || id === 'rna' || id === 'envelope'));
        return (
          <group
            key={id}
            ref={(g) => {
              refs.current[id] = g;
            }}
          >
            {show && (
              <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className={`pointer-events-auto max-w-[15rem] rounded-xl border bg-white/95 px-3 py-2 text-left text-[13px] leading-snug text-ink shadow-[0_8px_30px_-12px_rgba(11,18,32,.28)] backdrop-blur ${forced ? 'border-primary-600' : 'border-line'}`}
                >
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${dotClass(id)}`} aria-hidden="true" />
                  {part.label}
                </button>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function dotClass(id: PartId): string {
  switch (id) {
    case 'ha':
      return 'bg-primary-600';
    case 'na':
      return 'bg-h1n1';
    case 'rna':
      return 'bg-infb';
    default:
      return 'bg-line-strong';
  }
}

// ---------- Canvas ----------
export default function VirusCanvas(props: VirusCanvasProps) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, 1.5]}
      frameloop="demand"
      flat
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 36, near: 0.1, far: 60, position: [0, 0.15, 5.4] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      onPointerMissed={() => props.onHover(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
