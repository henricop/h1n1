'use client';
/**
 * Vírion A(H1N1) procedural em react-three-fiber. Um único driver (prioridade -10) amortece o progresso de
 * rolagem (`progress`, MotionValue) em `pAnim`, avalia `sceneAt(pAnim)` e escreve em `stateRef`/`ambientRef`;
 * os módulos de cena (scene/*) só leem dentro de `useFrame`. Carregado com next/dynamic (ssr: false); o pôster
 * cobre o carregamento até `onReady` (depois da pré-compilação dos shaders).
 *
 * Frameloop (decisão 4): `always` com a seção visível e a aba ativa; `never` fora da tela; `demand` com
 * reduced-motion; em `quality: 'low'`, `never` + rAF próprio a ~30 fps (`FrameloopPolicy`).
 *
 * v4 (frente C, docs/reformulacao-v4.md §7 "Palco 3D"):
 *  - canvas OPACO; `scene.background` é um THREE.Color criado uma vez e mutado por quadro (prioridade −11) a
 *    partir da cor VIVA do tema (`themeColor` ou `getLiveTheme()`); `subscribeTheme` → `invalidate()`. A mesma
 *    cor alimenta a luz (lib/virus/lighting.ts → `lookRef`), o ambiente e a sombra;
 *  - enquadramento por `viewShift` (fração da viewport) com `camera.setViewOffset` depois do `lookAt`,
 *    amortecido; projeção dos rótulos, `unproject` e picking continuam coerentes (usam a projectionMatrix);
 *  - `eventSource` (contêiner do filme) + `eventPrefix="client"`, com `compute` que desconta o retângulo do
 *    canvas; eventos só com `interactive` (modo explorar); alvos do DOM (botões, links, painéis com
 *    `data-canvas-ignore`) não geram hover/clique/`onPointerMissed` na cena;
 *  - `resize={{ scroll: false, debounce: 200 }}`, `touch-action: pan-y` e `pointer-events` por `interactive`;
 *  - rótulos limitados à `labelRegion` (região livre de texto).
 */
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getLiveTheme, subscribeTheme, type ThemeRGB } from '@/lib/motion/theme';
import { CAMERA_FOV, SPIN_RATE, ambient, drift, fitDistance, sceneAt, settledProgress } from '@/lib/virus/choreography';
import { dampTo, expDamp, type Damped } from '@/lib/virus/damping';
import { MAX_DPR, frameloopPolicy, isDomControl, shouldRenderFrame, stageDpr, transmissionScale, viewOffsetFor, type FrameloopMode, type LabelRegion, type ViewShift } from '@/lib/virus/explainer';
import { clamp01 } from '@/lib/virus/geometry';
import { createStageLook, stageLook, type StageLook } from '@/lib/virus/lighting';
import type { PartId } from '@/lib/virus/parts';
import { spikeLayout, type Quality } from '@/lib/virus/pose';
import { cloneState, REST } from '@/lib/virus/scenestate';
import { Antibodies } from './scene/Antibodies';
import { Cell } from './scene/Cell';
import { Labels, type LabelCards, type LabelRegionRef } from './scene/Labels';
import { Lighting } from './scene/Lighting';
import { Droplets, People } from './scene/Spread';
import { Virion } from './scene/Virion';
import type { AmbientRef, AmbientState, LookRef, StateRef } from './scene/shared';

export interface VirusCanvasProps {
  /** progresso contínuo [0, 5) vindo da rolagem (por passos de texto) */
  progress: MotionValue<number>;
  /** capítulo fixo (reduced-motion / botões); null = seguir `progress` */
  chapterOverride: number | null;
  reducedMotion: boolean;
  quality: Quality;
  /** seção visível na janela E aba ativa (controla o frameloop; a abertura pode pausar após 5 s alternando-o) */
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
  /**
   * Cor viva do fundo do tema: objeto MUTÁVEL `{ r, g, b }` (sRGB 0–255) lido a cada quadro — passe
   * `getLiveTheme()` (padrão quando omitido), nunca uma cópia por render. Canvas opaco nessa cor.
   */
  themeColor?: ThemeRGB;
  /**
   * Enquadramento: fração da viewport (+x = conteúdo à direita, +y = conteúdo para cima), via
   * `camera.setViewOffset`; mudanças são amortecidas (~0,35 s; instantâneas em reduced-motion). Ex.: abertura
   * no desktop `{ x: 0.18, y: 0 }`; celular `{ x: 0, y: 0.25 }` (vírion no quarto superior). Padrão `{0, 0}`.
   */
  viewShift?: ViewShift;
  /**
   * Ancestral comum do palco e do texto (contêiner do filme), passado ao `<Canvas eventSource>`: com ele o
   * hover/clique nas peças funcionam com o DOM por cima. Ref nulo no 1.º render é resolvido pelo r3f.
   */
  eventSource?: React.RefObject<HTMLElement | null>;
  /**
   * Modo "explorar" (ato 2): só então a cena recebe ponteiro (`pointer-events: auto`, eventos do r3f ligados).
   * Padrão: `true` sem `eventSource` (layout antigo), `false` com `eventSource`.
   */
  interactive?: boolean;
  /** Região (frações 0–1 da largura/altura do canvas) onde os cartões de rótulo podem ficar, longe do texto. Padrão: palco inteiro com LABEL_PAD. */
  labelRegion?: LabelRegion;
}

const ZERO_SHIFT: Readonly<ViewShift> = { x: 0, y: 0 };

/** Fundo e luz do tema (prioridade −11, antes do driver): muta `scene.background` e recalcula `look` só quando a cor muda. */
function ThemeStage({ themeRef, look }: { themeRef: React.RefObject<ThemeRGB | undefined>; look: StageLook }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const bg = useMemo(() => new THREE.Color(), []);
  const last = useRef({ r: NaN, g: NaN, b: NaN });
  const apply = () => {
    const c = themeRef.current ?? getLiveTheme();
    const l = last.current;
    if (c.r === l.r && c.g === l.g && c.b === l.b) return;
    l.r = c.r;
    l.g = c.g;
    l.b = c.b;
    bg.setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace);
    stageLook(c, look);
  };
  useLayoutEffect(() => {
    apply();
    const prev = scene.background;
    scene.background = bg;
    return () => {
      if (scene.background === bg) scene.background = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, bg]);
  // modo `demand` (reduced-motion): cada passo da interpolação do tema pede um quadro
  useEffect(() => subscribeTheme(() => invalidate()), [invalidate]);
  useFrame(apply, -11);
  return null;
}

/** Aplica `viewShift` (já amortecido) à câmera; só chama setViewOffset quando o resultado em px muda. */
function applyViewShift(camera: THREE.Camera, shift: Readonly<ViewShift>, w: number, h: number, last: { x: number; y: number; w: number; h: number }): void {
  const cam = camera as THREE.PerspectiveCamera;
  if (!cam.isPerspectiveCamera) return;
  const off = viewOffsetFor(shift, w, h);
  if (!off) {
    if (cam.view?.enabled) cam.clearViewOffset();
    last.x = NaN;
    return;
  }
  if (cam.view?.enabled && last.x === off.x && last.y === off.y && last.w === w && last.h === h) return;
  cam.setViewOffset(w, h, off.x, off.y, w, h);
  last.x = off.x;
  last.y = off.y;
  last.w = w;
  last.h = h;
}

/** Driver: escreve o estado da cena e posiciona câmera e grupo micro; roda antes de todos (prioridade -10). */
function Driver({
  progress,
  chapterOverride,
  reducedMotion,
  stateRef,
  ambientRef,
  shiftRef,
  micro,
  virion,
}: {
  progress: MotionValue<number>;
  chapterOverride: number | null;
  reducedMotion: boolean;
  stateRef: StateRef;
  ambientRef: AmbientRef;
  shiftRef: React.RefObject<ViewShift | undefined>;
  micro: React.RefObject<THREE.Group | null>;
  virion: React.RefObject<THREE.Group | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const regress = useThree((s) => s.performance.regress);
  const damped = useRef<Damped>({ value: progress.get(), velocity: 0 });
  const look = useMemo(() => new THREE.Vector3(), []);
  const shiftNow = useRef<ViewShift>({ x: NaN, y: NaN });
  const shiftApplied = useRef({ x: NaN, y: NaN, w: 0, h: 0 });
  useEffect(
    () =>
      progress.on('change', () => {
        // rolagem em curso: StageDpr baixa a resolução até a rolagem assentar
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
      // deriva ambiente (precessão + flutuação) só com o vírion livre; zera no encaixe e em reduced-motion
      const free = reducedMotion ? 0 : clamp01((s.spin - 0.05) / 0.1);
      const dr = drift(a.t);
      v.rotation.set(dr.tiltX * free, a.yaw, dr.tiltZ * free);
      // tentativa de encaixe bloqueada (capítulo 5): avança e recua
      v.position.set(Math.sin(Math.PI * s.block) * 0.28, dr.floatY * free, 0);
    }
    const { camera, size } = state;
    const fit = fitDistance(size.width / Math.max(1, size.height));
    camera.position.set(s.camX, s.camY, s.camZ * fit);
    look.set(s.lookX, s.lookY, s.lookZ);
    camera.lookAt(look);

    // enquadramento deslocado (fração da viewport), amortecido; instantâneo em reduced-motion
    const want = shiftRef.current ?? ZERO_SHIFT;
    const wx = Number.isFinite(want.x) ? want.x : 0;
    const wy = Number.isFinite(want.y) ? want.y : 0;
    const sn = shiftNow.current;
    if (reducedMotion || !Number.isFinite(sn.x) || !Number.isFinite(sn.y)) {
      sn.x = wx;
      sn.y = wy;
    } else {
      sn.x = expDamp(sn.x, wx, dt, 0.35);
      sn.y = expDamp(sn.y, wy, dt, 0.35);
    }
    applyViewShift(camera, sn, size.width, size.height, shiftApplied.current);

    // em 'demand' (reduced-motion) pede o próximo quadro só enquanto algo ainda se move
    const moving = Math.abs(d.value - target) > 1e-5 || Math.abs(d.velocity) > 1e-4 || (!reducedMotion && s.spin > 0.01) || sn.x !== wx || sn.y !== wy;
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

/**
 * DPR adaptativo pela qualidade ATUAL: baixa durante a rolagem (`performance.regress`) e volta ao teto da
 * qualidade (1,5 em 'high', 1,25 em 'low'). Substitui o `<AdaptiveDpr>` do drei, que voltava ao DPR da criação.
 */
function StageDpr({ quality }: { quality: Quality }) {
  const current = useThree((s) => s.performance.current);
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setDpr(stageDpr(typeof window === 'undefined' ? 1 : window.devicePixelRatio, quality, current));
  }, [current, quality, setDpr]);
  return null;
}

/** Liga/desliga os eventos de ponteiro do r3f (modo explorar) e limpa o hover ao sair dele. */
function EventsPolicy({ interactive, onHover }: { interactive: boolean; onHover: (p: PartId | null) => void }) {
  const setEvents = useThree((s) => s.setEvents);
  useEffect(() => {
    setEvents({ enabled: interactive });
    if (!interactive) onHover(null);
  }, [interactive, setEvents, onHover]);
  return null;
}

/** Materiais que alternam `transparent` em cena (ex.: M1 no `uncoat`): pré-compila também a variante alternativa. */
function altTransparentMaterials(scene: THREE.Object3D): THREE.Material[] {
  const out = new Set<THREE.Material>();
  scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) if (m.userData?.altTransparent) out.add(m);
  });
  return [...out];
}

function Scene(props: VirusCanvasProps & { mode: FrameloopMode; interactive: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const advance = useThree((s) => s.advance);
  const stateRef = useRef(cloneState(REST)) as StateRef;
  const ambientRef = useRef<AmbientState>({ t: 0, yaw: 0, breath: 0, wobble: 0, blink: 0 });
  const look = useMemo(() => stageLook(props.themeColor ?? getLiveTheme(), createStageLook()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lookRef = useRef(look) as LookRef;
  // props lidas por quadro: refs atualizados a cada render (sem efeito, sem re-render por quadro)
  const themeRef = useRef<ThemeRGB | undefined>(props.themeColor);
  themeRef.current = props.themeColor;
  const shiftRef = useRef<ViewShift | undefined>(props.viewShift);
  shiftRef.current = props.viewShift;
  const regionRef: LabelRegionRef = useRef<LabelRegion | null | undefined>(props.labelRegion);
  regionRef.current = props.labelRegion;
  const micro = useRef<THREE.Group>(null);
  const virion = useRef<THREE.Group>(null);
  const { onReady, onQualityFallback, quality, mode } = props;
  const layout = useMemo(() => spikeLayout(quality), [quality]);

  useEffect(() => {
    invalidate();
  }, [props.hovered, props.selected, props.viewShift, props.labelRegion, invalidate]);
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
    const flip = (mats: THREE.Material[]) => {
      for (const m of mats) {
        m.transparent = !m.transparent;
        m.needsUpdate = true;
      }
    };
    const compileAll = async () => {
      await gl.compileAsync(scene, camera);
      // segunda passada só para as variantes alternativas (M1 transparente no `uncoat`)
      const alts = altTransparentMaterials(scene);
      if (alts.length > 0 && alive) {
        flip(alts);
        try {
          await gl.compileAsync(scene, camera);
        } finally {
          flip(alts);
        }
      }
    };
    compileAll().then(
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
      <ThemeStage themeRef={themeRef} look={look} />
      <Driver progress={props.progress} chapterOverride={props.chapterOverride} reducedMotion={props.reducedMotion} stateRef={stateRef} ambientRef={ambientRef} shiftRef={shiftRef} micro={micro} virion={virion} />
      <FrameloopPolicy mode={mode} />
      <EventsPolicy interactive={props.interactive} onHover={props.onHover} />
      <StageDpr quality={quality} />
      {/* só mede fps com o laço contínuo (em 'demand'/'manual' a cadência é propositalmente baixa) */}
      {mode === 'always' && onQualityFallback && <PerformanceMonitor flipflops={3} onFallback={onQualityFallback} />}
      <Lighting stateRef={stateRef} lookRef={lookRef} quality={quality} />

      {/* grupo micro (posição/escala do driver): vírion (gira com o yaw) + célula (não gira) */}
      <group ref={micro}>
        <group ref={virion}>
          <Virion stateRef={stateRef} ambientRef={ambientRef} lookRef={lookRef} quality={quality} layout={layout} hovered={props.hovered} selected={props.selected} onHover={props.onHover} onSelect={props.onSelect} />
          <Antibodies stateRef={stateRef} ambientRef={ambientRef} quality={quality} layout={layout} />
          <Labels stateRef={stateRef} lookRef={lookRef} layout={layout} hovered={props.hovered} selected={props.selected} cards={props.labelCards} regionRef={regionRef} />
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
  const interactive = props.interactive ?? !props.eventSource;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  /** o alvo do último evento é um controle do DOM por cima do palco (ver `isDomControl`) */
  const domBlocked = useRef(false);
  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, MAX_DPR[props.quality]]}
      // o modo real é aplicado por <FrameloopPolicy>; aqui só o valor inicial (nada roda antes de a seção aparecer)
      frameloop="never"
      flat
      gl={{ alpha: false, antialias: true, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 60, position: [0, 0.15, 5.6] }}
      performance={{ min: 0.6 }}
      // palco sticky de 100lvh: sem medir na rolagem; redimensiona com folga (barra do Safari, rotação)
      resize={{ scroll: false, debounce: 200 }}
      eventSource={props.eventSource}
      eventPrefix="client"
      onCreated={(state: RootState) => {
        const { gl } = state;
        // canvas opaco já na cor viva do tema (antes do 1.º quadro um canvas opaco apareceria preto)
        const c = props.themeColor ?? getLiveTheme();
        gl.setClearColor(new THREE.Color().setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace), 1);
        gl.clear();
        gl.transmissionResolutionScale = transmissionScale(props.quality);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          props.onContextLost?.();
        });
        state.setEvents({
          enabled: interactiveRef.current,
          // coordenadas do cliente descontando o retângulo REAL do canvas (o palco sticky nem sempre está no topo;
          // com `resize.scroll: false` o size.top/left do r3f não acompanha a rolagem)
          compute: (event, st) => {
            if (!st.events.enabled) return;
            domBlocked.current = isDomControl(event.target);
            const r = st.gl.domElement.getBoundingClientRect();
            const w = Math.max(1, r.width);
            const h = Math.max(1, r.height);
            st.pointer.set(((event.clientX - r.left) / w) * 2 - 1, -((event.clientY - r.top) / h) * 2 + 1);
            st.raycaster.setFromCamera(st.pointer, st.camera);
          },
          // ponteiro sobre botão/link/painel do DOM: a cena não vê nada (sem hover, sem clique)
          filter: (hits) => (domBlocked.current ? [] : hits),
        });
      }}
      onPointerMissed={(e) => {
        if (!interactiveRef.current || isDomControl(e.target)) return;
        props.onHover(null);
      }}
      style={{ position: 'absolute', inset: 0, touchAction: 'pan-y', pointerEvents: interactive ? 'auto' : 'none' }}
    >
      <Scene {...props} mode={mode} interactive={interactive} />
    </Canvas>
  );
}
