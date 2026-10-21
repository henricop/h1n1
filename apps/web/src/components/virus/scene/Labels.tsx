'use client';
/**
 * Rótulos das peças: os 6 cartões são DOM comum, montados pelo explainer sobre o palco (sem drei <Html>, que
 * perdia cartões com React 19 em modo estrito). Aqui, a cada quadro (prioridade -1, depois do driver), o ponto
 * 3D de cada peça é projetado para a tela, o centro do cartão é limitado ao retângulo útil do palco e o estilo
 * (transform/opacity/visibility) é escrito direto no elemento; uma linha-guia fina vai da peça ao cartão.
 * Opacidade amortecida por ref (expDamp) a partir de `stateRef.current.labels` (4 principais) ou de hover/seleção.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { expDamp } from '@/lib/virus/damping';
import { LABEL_IDS, LABEL_POINTER_THRESHOLD, clampToStage, compactStage, labelPosition, labelTarget, spreadLabels } from '@/lib/virus/explainer';
import type { PartId } from '@/lib/virus/parts';
import { partAnchor, type SpikeLayout } from '@/lib/virus/pose';
import type { StateRef } from './shared';

export type LabelCards = MutableRefObject<Record<PartId, HTMLButtonElement | null>>;

/** Token line-strong de globals.css (linha-guia). */
const LINE_STRONG = '#c7d0de';

function makeLine(): THREE.Line {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const mat = new THREE.LineBasicMaterial({ color: LINE_STRONG, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const line = new THREE.Line(geom, mat);
  line.visible = false;
  line.frustumCulled = false;
  line.renderOrder = 5;
  return line;
}

export function Labels({ stateRef, layout, hovered, selected, cards }: { stateRef: StateRef; layout: SpikeLayout; hovered: PartId | null; selected: PartId | null; cards: LabelCards }) {
  const root = useRef<THREE.Group>(null);
  const lines = useMemo(() => {
    const out = {} as Record<PartId, THREE.Line>;
    for (const id of LABEL_IDS) out[id] = makeLine();
    return out;
  }, []);
  const opacity = useRef<Record<PartId, number>>({ ha: 0, na: 0, rna: 0, envelope: 0, m1: 0, m2: 0 });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), n: new THREE.Vector3() }), []);
  // posições de tela por rótulo (reutilizadas por quadro, sem alocação)
  const screen = useMemo(() => {
    const out = {} as Record<PartId, { x: number; y: number; z: number; on: boolean }>;
    for (const id of LABEL_IDS) out[id] = { x: 0, y: 0, z: 0, on: false };
    return out;
  }, []);
  const visible = useMemo(() => [] as Array<{ x: number; y: number }>, []);
  useEffect(
    () => () => {
      for (const id of LABEL_IDS) {
        lines[id].geometry.dispose();
        (lines[id].material as THREE.Material).dispose();
      }
    },
    [lines],
  );
  // hover/seleção vêm por props; o quadro lê a cópia por ref (sem re-render por quadro)
  const hot = useRef<{ hovered: PartId | null; selected: PartId | null }>({ hovered, selected });
  hot.current.hovered = hovered;
  hot.current.selected = selected;
  // ao desmontar o canvas, esconde os cartões (eles vivem no explainer)
  useEffect(
    () => () => {
      for (const id of LABEL_IDS) {
        const card = cards.current[id];
        if (card) {
          card.style.opacity = '0';
          card.style.visibility = 'hidden';
          card.style.pointerEvents = 'none';
        }
      }
    },
    [cards],
  );

  useFrame(({ camera, size }, delta) => {
    const g = root.current;
    if (!g) return;
    // o driver (prioridade -10) acabou de mover câmera e grupos: atualiza as matrizes antes de projetar
    g.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    const dt = Math.min(Math.max(0, delta), 0.05);
    const s = stateRef.current;
    const { hovered: h, selected: sel } = hot.current;
    visible.length = 0;
    const compact = compactStage(size.width, size.height);
    for (const id of LABEL_IDS) {
      const target = labelTarget(id, compact ? 0 : s.labels, h, sel);
      const op = expDamp(opacity.current[id], target, dt, 0.12);
      opacity.current[id] = op;
      const sc = screen[id];
      sc.on = op > 0.01;
      if (!sc.on) continue;
      const a = partAnchor(id, s, layout);
      const p = labelPosition(id, a);
      // peça → mundo → tela; centro do cartão limitado ao palco
      tmp.v.set(p.x, p.y, p.z).applyMatrix4(g.matrixWorld);
      tmp.n.copy(tmp.v).project(camera);
      const c = clampToStage(((tmp.n.x + 1) / 2) * size.width, ((1 - tmp.n.y) / 2) * size.height, size.width, size.height);
      sc.x = c.x;
      sc.y = c.y;
      sc.z = tmp.n.z;
      visible.push(sc);
    }
    // cartões empurrados para a mesma borda não podem se cobrir
    spreadLabels(visible, size.width, size.height);
    for (const id of LABEL_IDS) {
      const op = opacity.current[id];
      const line = lines[id];
      const card = cards.current[id];
      const sc = screen[id];
      if (!sc.on) {
        line.visible = false;
        if (card && card.style.visibility !== 'hidden') {
          card.style.opacity = '0';
          card.style.visibility = 'hidden';
          card.style.pointerEvents = 'none';
        }
        continue;
      }
      if (card) {
        card.style.transform = `translate(-50%, -50%) translate(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px)`;
        card.style.opacity = op.toFixed(3);
        card.style.visibility = 'visible';
        card.style.pointerEvents = op > LABEL_POINTER_THRESHOLD ? 'auto' : 'none';
      }
      // fim da linha-guia: o centro do cartão (já limitado) de volta ao espaço local, na mesma profundidade
      const a = partAnchor(id, s, layout);
      tmp.n.set((sc.x / size.width) * 2 - 1, 1 - (sc.y / size.height) * 2, sc.z).unproject(camera);
      g.worldToLocal(tmp.n);
      const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, a.x, a.y, a.z);
      pos.setXYZ(1, tmp.n.x, tmp.n.y, tmp.n.z);
      pos.needsUpdate = true;
      line.visible = true;
      (line.material as THREE.LineBasicMaterial).opacity = op * 0.9;
    }
  }, -1);

  return (
    <group ref={root}>
      {LABEL_IDS.map((id) => (
        <primitive key={id} object={lines[id]} />
      ))}
    </group>
  );
}
