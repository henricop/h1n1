import type { JourneySnapshot } from './types';
import { localized } from '../i18n';

/** A story for the simulated person. Symptoms are illustrative hypotheses, never model outputs or clinical measurements. */
export function patientState(snapshot: JourneySnapshot) {
  const affected = snapshot.regions.filter(region => region.infectedCellRatio > 0 || region.exposedCellRatio > 0);
  const damaged = snapshot.regions.some(region => region.damagedCellRatio > 0 || region.tissueIntegrity < 82);
  const recovering = snapshot.regions.some(region => region.recoveringCellRatio > 0);
  const stage = snapshot.body.stage;
  const variants = {
    exposure: { title: localized('Initial contact', 'Contato inicial'), description: localized('The virus has reached the mucosa. The simulated person may not feel anything yet.', 'A mucosa entrou em contato com o vírus. A pessoa simulada ainda pode não sentir nada.'), symptoms: [localized('No apparent symptoms', 'Sem sintomas aparentes'), localized('Possible nasal irritation', 'Irritação nasal possível')] },
    local: { title: localized('Localized infection', 'Infecção localizada'), description: localized('Activity has reached airway cells. The body is beginning to respond.', 'A atividade alcançou células das vias respiratórias. O corpo começa a reagir.'), symptoms: [localized('Possible runny nose', 'Coriza possível'), localized('Irritated throat', 'Garganta irritada'), localized('Possible cough', 'Tosse possível')] },
    response: { title: localized('Defense at work', 'Defesa em ação'), description: localized('The body is responding while infection continues in some regions.', 'A resposta do corpo está ativa enquanto a infecção continua em algumas regiões.'), symptoms: [localized('Cough', 'Tosse'), localized('Possible fatigue', 'Cansaço possível'), localized('Possible fever or aches', 'Febre ou dores possíveis')] },
    worsening: { title: localized('More tissue involvement', 'Maior comprometimento'), description: localized('The illustration shows more inflammation and a loss of tissue integrity.', 'A ilustração mostra mais inflamação e perda de integridade do tecido.'), symptoms: [localized('Stronger cough', 'Tosse mais intensa'), localized('Fatigue', 'Cansaço'), localized('Possible fever or aches', 'Febre ou dores possíveis')] },
    recovering: { title: localized('Recovering', 'Em recuperação'), description: localized('Viral activity is falling as the tissue begins to rebuild.', 'A atividade viral diminui e o tecido começa a ser recomposto.'), symptoms: [localized('Possible lingering cough', 'Tosse residual possível'), localized('Possible fatigue', 'Cansaço possível')] },
    controlled: { title: localized('Activity controlled', 'Atividade controlada'), description: localized('Defense contained viral activity in this scenario. Repair may continue.', 'A defesa conteve a atividade viral neste cenário. O reparo pode continuar.'), symptoms: [localized('Symptoms easing', 'Sintomas em redução'), localized('Possible lingering cough', 'Tosse residual possível')] },
  } as const;
  const base = variants[stage];
  return {
    ...base,
    affectedRegions: affected.length,
    tissueNote: damaged ? localized('The model shows affected tissue.', 'Há tecido afetado no modelo.') : recovering ? localized('New cells are recovering.', 'Há células novas em recuperação.') : localized('The tissue barrier remains intact.', 'A barreira do tecido segue preservada.'),
    viral: Math.round(snapshot.body.viralActivity),
    integrity: Math.round(snapshot.body.tissueIntegrity),
  };
}
