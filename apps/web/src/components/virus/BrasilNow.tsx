/**
 * Compatibilidade: o antigo "Como está o Brasil" virou o ato 6 da home (components/home/BrasilAct). Mantido como
 * wrapper para quem ainda importa daqui.
 */
import { BrasilAct, FLUNET_ID, SIVEP_ID } from '@/components/home/BrasilAct';

export const BRASIL_INDICATORS = [SIVEP_ID, FLUNET_ID] as const;

export async function BrasilNow() {
  return BrasilAct();
}
