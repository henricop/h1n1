import type { ReactNode } from 'react';

/** Lista numerada de passos com destaque; filhos devem ser <li> ou um <ol>. */
export function Passos({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="my-6 rounded-md border border-line bg-paper p-4">
      {titulo && <h3 className="mb-2 text-base font-semibold text-ink">{titulo}</h3>}
      <div className="[&>ol]:list-decimal [&>ol]:pl-6 [&>ol>li]:my-2 [&>ol>li]:pl-1 [&>ol>li::marker]:font-semibold [&>ol>li::marker]:text-signal">{children}</div>
    </section>
  );
}
