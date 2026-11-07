import type { AdversityDefinition, InitialConditions, JourneyConfig } from '../../journey/types';

/** All coefficients are internal illustrative mechanics, not calibrated human rates. */
export const DEFAULT_JOURNEY_CONFIG: JourneyConfig = {
  seed: 2009, horizonDays: 14, cellsPerRegion: 64,
  initialConditions: { defense: 0.65, resilience: 0.7, protection: 0.12, vulnerability: 0.12, exposure: 0.55 },
};
export const INITIAL_PRESETS: { id: string; name: string; description: string; initialConditions: InitialConditions }[] = [
  { id: 'typical', name: 'Defesa típica', description: 'Um ponto de partida equilibrado para explorar a jornada.', initialConditions: { ...DEFAULT_JOURNEY_CONFIG.initialConditions } },
  { id: 'reduced', name: 'Defesa reduzida', description: 'Menor capacidade inicial de conter a atividade e reparar o tecido neste modelo.', initialConditions: { defense: 0.25, resilience: 0.4, protection: 0.04, vulnerability: 0.35, exposure: 0.55 } },
  { id: 'protected', name: 'Proteção prévia', description: 'O modelo começa com maior proteção e memória de resposta ilustrativas.', initialConditions: { defense: 0.75, resilience: 0.8, protection: 0.7, vulnerability: 0.1, exposure: 0.55 } },
];
export const ADVERSITIES: AdversityDefinition[] = [
  { kind: 'sleep', title: 'Dormiu mal por 2 noites', description: 'Reduz temporariamente a capacidade de resposta e o reparo ilustrativos.', parameter: 'eficiência da defesa e velocidade de reparo', regional: false, defaultDuration: 48 },
  { kind: 'stress', title: 'Período de estresse intenso', description: 'Altera a resiliência do tecido e a resposta de defesa deste cenário.', parameter: 'resiliência tecidual e eficiência da resposta', regional: false, defaultDuration: 72 },
  { kind: 'smoke', title: 'Irritação das vias respiratórias', description: 'Adiciona irritação local e reduz a barreira epitelial no modelo.', parameter: 'barreira epitelial e irritação local', regional: true, defaultDuration: 24 },
  { kind: 'dehydration', title: 'Hidratação insuficiente', description: 'Dificulta o reparo e eleva o índice interno de desconforto.', parameter: 'velocidade de reparo e desconforto', regional: false, defaultDuration: 36 },
  { kind: 'reduced-defense', title: 'Defesa inicialmente reduzida', description: 'Configura uma capacidade basal de resposta menor, antes da exposição.', parameter: 'capacidade basal de defesa', regional: false, initialOnly: true, defaultDuration: 504 },
  { kind: 'respiratory-vulnerability', title: 'Maior vulnerabilidade respiratória', description: 'O tecido começa menos resiliente, sem representar uma doença específica.', parameter: 'vulnerabilidade e resiliência do tecido', regional: true, initialOnly: true, defaultDuration: 504 },
  { kind: 'prior-protection', title: 'Proteção prévia', description: 'Aumenta a proteção inicial e a memória de resposta ilustrativa.', parameter: 'proteção inicial e memória de defesa', regional: false, initialOnly: true, defaultDuration: 504 },
  { kind: 'rest', title: 'Condições favoráveis de recuperação', description: 'Favorece o reparo e o suporte geral da resposta neste cenário.', parameter: 'reparo tecidual, resiliência e suporte de defesa', regional: false, defaultDuration: 72 },
  { kind: 'viral-rate', title: 'Ritmo viral aumentado', description: 'Acelera o contato com células e a replicação ilustrativa a partir deste instante.', parameter: 'multiplicador do ritmo viral', regional: false, defaultDuration: 504 },
];
export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
export function normalizeJourneyConfig(input: Partial<JourneyConfig> = {}, base = DEFAULT_JOURNEY_CONFIG): JourneyConfig {
  const initial = { ...base.initialConditions, ...input.initialConditions };
  for (const key of Object.keys(initial) as (keyof InitialConditions)[]) initial[key] = clamp(finite(initial[key], DEFAULT_JOURNEY_CONFIG.initialConditions[key]));
  return { seed: Math.trunc(finite(input.seed ?? base.seed, 2009)) >>> 0, horizonDays: (input.horizonDays ?? base.horizonDays) === 21 ? 21 : 14,
    cellsPerRegion: Math.round(clamp(finite(input.cellsPerRegion ?? base.cellsPerRegion, 64), 16, 96)), initialConditions: initial };
}
