'use client';
/**
 * Vírion A(H1N1) procedural em react-three-fiber. Um único driver (prioridade -10) amortece o progresso de
 * rolagem (`progress`, MotionValue) em `pAnim`, avalia `sceneAt(pAnim)` e escreve em `stateRef`; os módulos de
 * cena (scene/*) só leem `stateRef`/`ambientRef` dentro de `useFrame`. Carregado com next/dynamic (ssr: false);
 * o pôster SVG cobre o carregamento e o fallback.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SPIN_RATE, ambient, fitDistance, sceneAt, settledProgress } from '@/lib/virus/choreography';
import { dampTo, type Damped } from '@/lib/virus/damping';
import { fibonacciSphere } from '@/lib/virus/geometry';
import { cloneState, REST } from '@/lib/virus/scenestate';
import { PART_COLORS, type PartId } from '@/lib/virus/parts';
import { Antibodies } from './scene/Antibodies';
import { Cell } from './scene/Cell';
import { Labels } from './scene/Labels';
import { Droplets, People } from './scene/Spread';
import { Channels, Envelope, Matrix, Rnps, Spikes } from './scene/Virion';
import { COUNTS, rotateY, type AmbientState, type StateRef } from './scene/shared';

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

/** Driver: escreve o estado da cena e posiciona câmera e grupo micro; roda antes de todos (prioridade -10). */
function Driver({
  progress,
  chapterOverride,
  reducedMotion,
  stateRef,
  ambientRef,
  micro,
  virion,
}: {
  progress: MotionValue<number>;
  chapterOverride: number | null;
  reducedMotion: boolean;
  stateRef: StateRef;
  ambientRef: React.MutableRefObject<AmbientState>;
  micro: React.RefObject<THREE.Group | null>;
  virion: React.RefObject<THREE.Group | null>;
}) {
  const { invalidate, camera, size } = useThree();
  const damped = useRef<Damped>({ value: progress.get(), velocity: 0 });
  const look = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => progress.on('change', () => invalidate()), [progress, invalidate]);
  useEffect(() => {
    invalidate();
  }, [chapterOverride, invalidate]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = chapterOverride !== null ? settledProgress(chapterOverride) : progress.get();
    const d = damped.current;
    if (reducedMotion) {
      d.value = target;
      d.velocity = 0;
    } else dampTo(d, target, dt);
    const s = sceneAt(d.value);
    stateRef.current = s;

    const a = ambientRef.current;
    a.t += dt;
    const amb = ambient(a.t);
    a.breath = amb.breath;
    a.wobble = amb.wobble;
    a.blink = amb.blink;
    if (!reducedMotion) a.yaw += dt * SPIN_RATE * s.spin;
    // com o vírion encaixado (spin → 0), o yaw assenta no múltiplo de 2π mais próximo (quadro local = quadro micro)
    if (s.spin < 0.05 && (s.dock > 0 || s.block > 0)) {
      const k = Math.round(a.yaw / (Math.PI * 2)) * Math.PI * 2;
      a.yaw += (k - a.yaw) * (1 - Math.exp(-dt * 3));
    }

    const m = micro.current;
    if (m) {
      m.position.set(s.virusX, s.virusY, 0);
      m.scale.setScalar(s.virusScale);
    }
    const v = virion.current;
    if (v) {
      v.rotation.y = a.yaw;
      // tentativa de encaixe bloqueada (capítulo 5): avança e recua
      v.position.x = Math.sin(Math.PI * s.block) * 0.28;
    }
    const fit = fitDistance(size.width / Math.max(1, size.height));
    camera.position.set(s.camX, s.camY, s.camZ * fit);
    look.set(s.lookX, s.lookY, s.lookZ);
    camera.lookAt(look);

    const moving = Math.abs(d.value - target) > 1e-5 || Math.abs(d.velocity) > 1e-4 || (!reducedMotion && s.spin > 0.01);
    if (moving) invalidate();
  }, -10);
  return null;
}

function Scene(props: VirusCanvasProps) {
  const { invalidate } = useThree();
  const stateRef = useRef(cloneState(REST)) as StateRef;
  const ambientRef = useRef<AmbientState>({ t: 0, yaw: 0, breath: 0, wobble: 0, blink: 0 });
  const micro = useRef<THREE.Group>(null);
  const virion = useRef<THREE.Group>(null);
  const labelsRef = useRef(false);
  const [labelsOn, setLabelsOn] = useState(false);
  const { onReady } = props;

  useEffect(() => {
    invalidate();
  }, [props.hovered, props.selected, invalidate]);
  useEffect(() => {
    onReady?.();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // histerese para o estado React dos rótulos (único setState derivado do quadro)
  useFrame(() => {
    const lab = stateRef.current.labels > 0.5;
    if (lab !== labelsRef.current) {
      labelsRef.current = lab;
      setLabelsOn(lab);
    }
  }, -1);

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
      <Driver progress={props.progress} chapterOverride={props.chapterOverride} reducedMotion={props.reducedMotion} stateRef={stateRef} ambientRef={ambientRef} micro={micro} virion={virion} />
      <hemisphereLight args={['#ffffff', '#dfe6f2', 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.7} />
      <directionalLight position={[-4, 2, -3]} intensity={0.55} color="#dbe5ff" />
      <ambientLight intensity={0.3} />

      {/* grupo micro: vírion (gira) + membrana/célula (não gira) */}
      <group ref={micro}>
        <group ref={virion}>
          <Envelope stateRef={stateRef} active={isActive('envelope')} onOver={pointer.over('envelope')} onOut={pointer.out} onClick={pointer.click('envelope')} />
          <Matrix stateRef={stateRef} active={isActive('m1')} onOver={pointer.over('m1')} onOut={pointer.out} onClick={pointer.click('m1')} />
          <Spikes kind="ha" dirs={haDirs} stateRef={stateRef} active={isActive('ha')} onOver={pointer.over('ha')} onOut={pointer.out} onClick={pointer.click('ha')} />
          <Spikes kind="na" dirs={naDirs} stateRef={stateRef} active={isActive('na')} onOver={pointer.over('na')} onOut={pointer.out} onClick={pointer.click('na')} />
          <Channels dirs={m2Dirs} stateRef={stateRef} active={isActive('m2')} onOver={pointer.over('m2')} onOut={pointer.out} onClick={pointer.click('m2')} />
          <Rnps stateRef={stateRef} active={isActive('rna')} onOver={pointer.over('rna')} onOut={pointer.out} onClick={pointer.click('rna')} />
          <Antibodies haDirs={haDirs} count={counts.antibodies} stateRef={stateRef} />
          <Labels stateRef={stateRef} haDirs={haDirs} naDirs={naDirs} m2Dirs={m2Dirs} labelsOn={labelsOn} hovered={props.hovered} selected={props.selected} onSelect={props.onSelect} />
        </group>
        <Cell stateRef={stateRef} receptors={counts.receptors} />
      </group>

      <People stateRef={stateRef} />
      <Droplets stateRef={stateRef} count={counts.droplets} />

      {props.quality === 'high' && <ContactShadows position={[0, -1.95, 0]} opacity={0.22} scale={10} blur={2.6} far={3.2} color={PART_COLORS.ink} />}
    </>
  );
}

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
