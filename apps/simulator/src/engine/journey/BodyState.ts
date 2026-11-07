import type { BodyState, JourneyStage } from '../../journey/types';
import type { InternalRegion } from './internal';
import { clamp } from './config';

const weights = [.12, .12, .22, .24, .3];
export function aggregateBody(regions: InternalRegion[], previous: BodyState | null, hour: number, discomfortModifier = 0): BodyState {
  const weighted = (key: 'viralActivity' | 'immuneActivity' | 'inflammation' | 'tissueIntegrity') => regions.reduce((sum, region, index) => sum + region[key] * weights[index]!, 0);
  const viralActivity = weighted('viralActivity'), immuneActivity = weighted('immuneActivity'), inflammation = weighted('inflammation'), tissueIntegrity = weighted('tissueIntegrity');
  const discomfort = clamp(inflammation * .6 + (100 - tissueIntegrity) * .55 + viralActivity * .12 + discomfortModifier * 35, 0, 100);
  const condition = clamp(100 - (100 - tissueIntegrity) * .72 - inflammation * .32 - discomfort * .18, 0, 100);
  const infected = regions.reduce((sum, region) => sum + region.infectedCellRatio, 0);
  const exposed = regions.reduce((sum, region) => sum + region.exposedCellRatio, 0);
  const everInfected = regions.some(region => region.everInfected > 0);
  let stage: JourneyStage = 'local';
  if (viralActivity < .15 && !infected && !exposed && tissueIntegrity > 85) stage = 'controlled';
  else if (!everInfected) stage = 'exposure';
  else if (tissueIntegrity < 66 || inflammation > 48 || condition < 62 || viralActivity > 50 && inflammation > 22 && tissueIntegrity < 90) stage = 'worsening';
  else if ((previous && viralActivity < previous.viralActivity - .025 || viralActivity < 12 && inflammation < 18) && tissueIntegrity > 70 && immuneActivity > 18) stage = 'recovering';
  else if (immuneActivity > 22) stage = 'response';
  const factors = regions.flatMap(region => region.factors.map(factor => `${region.regionId}: ${factor}`)).filter((factor, index, all) => all.indexOf(factor) === index).slice(0, 18);
  return { viralActivity, immuneActivity, inflammation, tissueIntegrity, discomfort, condition, stage, factors,
    recoveryHour: previous?.recoveryHour ?? (stage === 'recovering' ? hour : null), worseningHour: previous?.worseningHour ?? (stage === 'worsening' ? hour : null) };
}
