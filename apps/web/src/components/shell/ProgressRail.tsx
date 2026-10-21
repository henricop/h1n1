'use client';
/**
 * Trilho de atos da home (contrato v4, frente A implementa; este é o esqueleto com a API final).
 * Observa as seções `[data-act]` do documento e destaca o ato visível; clique rola até o ato.
 */
export interface Act {
  /** id do elemento da seção (`<section id={id} data-act={index}>`) */
  id: string;
  /** numeral exibido, ex. "01" */
  index: string;
  /** rótulo curto, ex. "100 nanômetros" */
  label: string;
}

export function ProgressRail({ acts }: { acts: readonly Act[] }) {
  return (
    <nav aria-label="Atos" className="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
      <ol className="space-y-2">
        {acts.map((a) => (
          <li key={a.id}>
            <a href={`#${a.id}`} className="kicker-mono no-underline hover:text-ink">
              ( {a.index} ) {a.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
