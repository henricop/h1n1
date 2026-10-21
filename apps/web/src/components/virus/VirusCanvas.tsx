'use client';
/**
 * Vírion A(H1N1) procedural em react-three-fiber. Um único driver (prioridade -10) amortece o progresso de
 * rolagem (`progress`, MotionValue) em `pAnim`, avalia `sceneAt(pAnim)` e escreve em `stateRef`/`ambientRef`;
 * os módulos de cena (scene/*) só leem dentro de `useFrame`. Carregado com next/dynamic (ssr: false); o pôster
 * cobre o carregamento até `onReady` (depois da pré-compilação dos shaders).
 *
 * Frameloop (decisão 4): `always` com a seção visível e a aba ativa; `never` fora da tela; `demand` com
 * reduced-motion; em `quality: 'low'`, `never` + rAF próprio a ~30 fps (`FrameloopPolicy`).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SPIN_RATE, ambient, fitDistance, sceneAt, settledProgress } from '@/lib/virus/choreography';
import { dampTo, type Damped } from '@/lib/virus/damping';
import { CANVAS_BACKGROUND, frameloopPolicy, shouldRenderFrame, transmissionScale, type FrameloopMode } from '@/lib/virus/explainer';
import type { ThemeRGB } from '@/lib/motion/theme';
import type { PartId } from '@/lib/virus/parts';
import { spikeLayout, type Quality } from '@/lib/virus/pose';
import { cloneState, REST } from '@/lib/virus/scenestate';
import { Antibodies } from './scene/Antibodies';
import { Cell } from './scene/Cell';
import { Labels, type LabelCards } from './scene/Labels';
import { Lighting } from './scene/Lighting';
import { Droplets, People } from './scene/Spread';
import { Virion } from './scene/Virion';
import type { AmbientRef, AmbientState, StateRef } from './scene/shared';

export interface VirusCanvasProps {
  /** progresso contínuo [0, 5) vindo da rolagem (por passos de texto) */
  progress: MotionValue<number>;
  /** capítulo fixo (reduced-motion / botões); null = seguir `progress` */
  chapterOverride: number | null;
  reducedMotion: boolean;
  quality: Quality;
  /** seção visível na janela E aba ativa (controla o frameloop) */
  active: boolean;
  hovered: PartId | null;
  selected: PartId | null;
  onHover: (p: PartId | null) => void;
  onSelect: (p: PartId) => void;
  /** cartões de rótulo (DOM do explainer), posicionados por quadro pela cena */
  labelCards: LabelCards;
  /** chamado depois da pré-compilação dos shaders (o explainer esconde o pôster) */
  onReady?: () => void;
  /** PerformanceMonitor desistiu (3 oscilações): o explainer deve baixar `quality` para 'low' */
  onQualityFallback?: () => void;
  /** contexto WebGL perdido: o explainer volta ao pôster/versão em texto */
  onContextLost?: () => void;
  /** v4 (frente C): cor viva do fundo do tema, objeto MUTÁVEL lido por quadro (`getLiveTheme()`); canvas opaco, `scene.background` mutado em useFrame */
  themeColor?: ThemeRGB;
  /** v4 (frente C): fração da viewport aplicada com `camera.setViewOffset` (mobile y = 0.25; desktop x pequeno e positivo) */
  viewShift?: { x: number; y: number };
  /** v4 (frente C): ancestral comum do palco e do texto, passado ao `<Canvas eventSource>` (sem isso o DOM por cima impede o hover nas peças) */
  eventSource?: React.RefObject<HTMLElement | null>;
  /** v4 (frente C): só no modo "explorar" (ato 2) o canvas recebe ponteiro; fora dele `pointer-events: none` + `touch-action: pan-y` */
  interactive?: boolean;
  /** v4 (frente C): região (frações 0–1 da largura/altura do canvas) onde os cartões de rótulo podem ficar, longe do texto */
  labelRegion?: { left: number; top: number; right: number; bottom: number };
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
  ambientRef: AmbientRef;
  micro: React.RefObject<THREE.Group | null>;
  virion: React.RefObject<THREE.Group | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const regress = useThree((s) => s.performance.regress);
  const damped = useRef<Damped>({ value: progress.get(), velocity: 0 });
  const look = useMemo(() => new THREE.Vector3(), []);
  useEffect(
    () =>
      progress.on('change', () => {
        // rolagem em curso: AdaptiveDpr baixa a resolução até a rolagem assentar
        if (!reducedMotion) regress();
        invalidate();
      }),
    [progress, invalidate, regress, reducedMotion],
  );
  useEffect(() => {
    invalidate();
  }, [chapterOverride, invalidate]);

  useFrame((state, delta) => {
    const dt = Number.isFinite(delta) ? Math.min(Math.max(0, delta), 0.05) : 0;
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
    const { camera, size } = state;
    const fit = fitDistance(size.width / Math.max(1, size.height));
    camera.position.set(s.camX, s.camY, s.camZ * fit);
    look.set(s.lookX, s.lookY, s.lookZ);
    camera.lookAt(look);

    // em 'demand' (reduced-motion) pede o próximo quadro só enquanto algo ainda se move
    const moving = Math.abs(d.value - target) > 1e-5 || Math.abs(d.velocity) > 1e-4 || (!reducedMotion && s.spin > 0.01);
    if (moving) invalidate();
  }, -10);
  return null;
}

/** Aplica o modo de frameloop ao store do r3f; em `manual`, roda um rAF próprio limitado a ~30 fps. */
function FrameloopPolicy({ mode }: { mode: FrameloopMode }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    if (mode === 'manual') {
      setFrameloop('never');
      let raf = 0;
      let last = -Infinity;
      const tick = (t: number) => {
        raf = requestAnimationFrame(tick);
        if (!shouldRenderFrame(t, last)) return;
        last = t;
        // em 'never' o r3f usa o timestamp (em segundos) para calcular o delta dos useFrame
        advance(t / 1000);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setFrameloop(mode);
    if (mode !== 'never') invalidate();
    return undefined;
  }, [mode, setFrameloop, invalidate, advance]);
  return null;
}

function Scene(props: VirusCanvasProps & { mode: FrameloopMode }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const advance = useThree((s) => s.advance);
  const stateRef = useRef(cloneState(REST)) as StateRef;
  const ambientRef = useRef<AmbientState>({ t: 0, yaw: 0, breath: 0, wobble: 0, blink: 0 });
  const micro = useRef<THREE.Group>(null);
  const virion = useRef<THREE.Group>(null);
  const { onReady, onQualityFallback, quality, mode } = props;
  const layout = useMemo(() => spikeLayout(quality), [quality]);

  useEffect(() => {
    invalidate();
  }, [props.hovered, props.selected, invalidate]);
  useEffect(() => {
    gl.transmissionResolutionScale = transmissionScale(quality);
    invalidate();
  }, [gl, quality, invalidate]);
  // pré-compila todos os shaders antes de revelar o canvas (evita o engasgo do primeiro quadro de cada capítulo)
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (!alive) return;
      onReady?.();
      // um quadro imediato, mesmo em 'never' (seção ainda fora da tela): o pôster some sobre uma cena pronta
      advance(performance.now() / 1000);
    };
    // objetos ocultos (célula, pessoas, gotículas, anticorpos) ficam de fora do compileAsync: revela-os só para compilar
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const restore = () => {
      for (const o of hidden) o.visible = false;
    };
    gl.compileAsync(scene, camera).then(
      () => {
        restore();
        done();
      },
      () => {
        restore();
        done();
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Driver progress={props.progress} chapterOverride={props.chapterOverride} reducedMotion={props.reducedMotion} stateRef={stateRef} ambientRef={ambientRef} micro={micro} virion={virion} />
      <FrameloopPolicy mode={mode} />
      <AdaptiveDpr />
      {/* só mede fps com o laço contínuo (em 'demand'/'manual' a cadência é propositalmente baixa) */}
      {mode === 'always' && onQualityFallback && <PerformanceMonitor flipflops={3} onFallback={onQualityFallback} />}
      <Lighting stateRef={stateRef} quality={quality} />

      {/* grupo micro (posição/escala do driver): vírion (gira com o yaw) + célula (não gira) */}
      <group ref={micro}>
        <group ref={virion}>
          <Virion stateRef={stateRef} ambientRef={ambientRef} quality={quality} layout={layout} hovered={props.hovered} selected={props.selected} onHover={props.onHover} onSelect={props.onSelect} />
          <Antibodies stateRef={stateRef} ambientRef={ambientRef} quality={quality} layout={layout} />
          <Labels stateRef={stateRef} layout={layout} hovered={props.hovered} selected={props.selected} cards={props.labelCards} />
        </group>
        <Cell stateRef={stateRef} ambientRef={ambientRef} quality={quality} />
      </group>

      {/* mundo: silhuetas e gotículas (capítulo 4) */}
      <People stateRef={stateRef} />
      <Droplets stateRef={stateRef} ambientRef={ambientRef} quality={quality} />
    </>
  );
}

export default function VirusCanvas(props: VirusCanvasProps) {
  const mode = frameloopPolicy({ active: props.active, reducedMotion: props.reducedMotion, quality: props.quality });
  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, props.quality === 'low' ? 1.25 : 1.5]}
      // o modo real é aplicado por <FrameloopPolicy>; aqui só o valor inicial (nada roda antes de a seção aparecer)
      frameloop="never"
      flat
      gl={{ alpha: false, antialias: true, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 36, near: 0.1, far: 60, position: [0, 0.15, 5.6] }}
      performance={{ min: 0.6 }}
      onCreated={({ gl }) => {
        gl.setClearColor(CANVAS_BACKGROUND, 1);
        // limpa já: antes do 1.º quadro um canvas opaco apareceria preto
        gl.clear();
        gl.transmissionResolutionScale = transmissionScale(props.quality);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          props.onContextLost?.();
        });
      }}
      onPointerMissed={() => props.onHover(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* fundo OPACO no mesmo tom do contêiner (bg-soft): transmissão correta e sem blending do canvas */}
      <color attach="background" args={[CANVAS_BACKGROUND]} />
      <Scene {...props} mode={mode} />
    </Canvas>
  );
}
