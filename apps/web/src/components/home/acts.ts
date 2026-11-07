/**
 * Os sete atos da home, no formato do trilho de capítulos (components/shell/ProgressRail, frente A):
 * `id` = id da <section data-act>, `index` = numeral exibido, `label` = nome sem número.
 */
import type { Act } from '@/components/shell/ProgressRail';
import { CHAPTERS } from '@/lib/virus/chapters';
import { ACT_BRASIL, ACT_CONTINUE } from '@/lib/virus/copy';

export function actId(index: string): string {
  return `ato-${index}`;
}

export const HOME_ACTS: readonly Act[] = [
  ...CHAPTERS.map((c) => ({ id: actId(c.index), index: c.index, label: c.kicker })),
  { id: actId(ACT_BRASIL.index), index: ACT_BRASIL.index, label: ACT_BRASIL.kicker },
  { id: actId(ACT_CONTINUE.index), index: ACT_CONTINUE.index, label: ACT_CONTINUE.kicker },
];
