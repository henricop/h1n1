/** Funções puras do trilho de atos (testáveis em node). */

export interface Act {
  /** id do elemento da seção (`<section id={id} data-act={index}>`) */
  id: string;
  /** numeral exibido, ex. "01" */
  index: string;
  /** rótulo curto, ex. "O que é" */
  label: string;
}

/** Nome acessível de um ato: "Ato 1 de 7: O que é" (o numeral "( 01 )" é decorativo). */
export function actAccessibleName(act: Act, position: number, total: number): string {
  return `Ato ${position} de ${total}: ${act.label}`;
}

/** Numeral visível "( 01 )". */
export function actNumeral(act: Act): string {
  return `( ${act.index} )`;
}

/**
 * Progresso (0–1) da linha de referência (meio da janela) entre o topo do primeiro ato e o fim do último, em
 * coordenadas da viewport (`getBoundingClientRect`).
 */
export function actsProgress(firstTop: number, lastBottom: number, line: number): number {
  const span = lastBottom - firstTop;
  if (!(span > 0)) return 0;
  return Math.min(1, Math.max(0, (line - firstTop) / span));
}
