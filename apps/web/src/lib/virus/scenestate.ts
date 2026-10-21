/**
 * Estado da cena 3D do explicador: um registro numérico, puro, derivado do progresso de rolagem.
 * Contrato entre a coreografia (lib/virus/choreography.ts) e os módulos de cena (components/virus/scene/*).
 * Canais "unitários" vivem em [0, 1]; os demais em unidades de cena (ver BOUNDS).
 */
export const SCENE_KEYS = [
  // câmera (posição e alvo do lookAt)
  'camX',
  'camY',
  'camZ',
  'lookX',
  'lookY',
  'lookZ',
  // grupo micro (vírion + membrana + anticorpos): posição, escala e fator de rotação ambiente
  'virusX',
  'virusY',
  'virusScale',
  'spin',
  // desmontagem escalonada (capítulo 2) e realces do capítulo 1
  'openEnv',
  'openSpikes',
  'openM1',
  'openRnp',
  'labels',
  'hlHa',
  'hlNa',
  // célula (capítulo 3) e brotamento (capítulo 4)
  'membrane',
  'dock',
  'engulf',
  'uncoat',
  'release',
  'bud',
  // pessoas e gotículas (capítulo 4)
  'people',
  'droplets',
  // vacina (capítulo 5)
  'antibodies',
  'block',
  'drift',
  'rebind',
] as const;

export type SceneKey = (typeof SCENE_KEYS)[number];
export type SceneState = Record<SceneKey, number>;

/** Canais normalizados: sempre em [0, 1]. */
export const UNIT_KEYS: readonly SceneKey[] = [
  'spin',
  'openEnv',
  'openSpikes',
  'openM1',
  'openRnp',
  'labels',
  'hlHa',
  'hlNa',
  'membrane',
  'dock',
  'engulf',
  'uncoat',
  'release',
  'bud',
  'people',
  'droplets',
  'antibodies',
  'block',
  'drift',
  'rebind',
];

/** Limites por chave (unidades de cena), usados pelos testes e por quem precisar saturar. */
export const BOUNDS: Readonly<Record<SceneKey, readonly [number, number]>> = {
  camX: [-4, 4],
  camY: [-2, 3],
  camZ: [3, 16],
  lookX: [-4, 4],
  lookY: [-2, 3],
  lookZ: [-2, 2],
  virusX: [-4, 4],
  virusY: [-2, 3],
  virusScale: [0.05, 1.5],
  spin: [0, 1],
  openEnv: [0, 1],
  openSpikes: [0, 1],
  openM1: [0, 1],
  openRnp: [0, 1],
  labels: [0, 1],
  hlHa: [0, 1],
  hlNa: [0, 1],
  membrane: [0, 1],
  dock: [0, 1],
  engulf: [0, 1],
  uncoat: [0, 1],
  release: [0, 1],
  bud: [0, 1],
  people: [0, 1],
  droplets: [0, 1],
  antibodies: [0, 1],
  block: [0, 1],
  drift: [0, 1],
  rebind: [0, 1],
};

export function cloneState(s: Readonly<SceneState>): SceneState {
  return { ...s };
}

/** Estado "tudo em repouso" (vírion inteiro no centro, nada mais visível). */
export const REST: Readonly<SceneState> = Object.freeze({
  camX: 0,
  camY: 0.15,
  camZ: 5.6,
  lookX: 0,
  lookY: 0,
  lookZ: 0,
  virusX: 0,
  virusY: 0,
  virusScale: 1,
  spin: 0.6,
  openEnv: 0,
  openSpikes: 0,
  openM1: 0,
  openRnp: 0,
  labels: 0,
  hlHa: 0,
  hlNa: 0,
  membrane: 0,
  dock: 0,
  engulf: 0,
  uncoat: 0,
  release: 0,
  bud: 0,
  people: 0,
  droplets: 0,
  antibodies: 0,
  block: 0,
  drift: 0,
  rebind: 0,
});
