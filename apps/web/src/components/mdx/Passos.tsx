import type { ReactNode } from 'react';

/** Lista numerada de passos com destaque; filhos devem ser <li> ou um <ol>. */
export function Passos({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="card my-6 p-5">
      {titulo && <h3 className="mb-2 font-display text-lg font-bold text-ink">{titulo}</h3>}
      <div className="[&>ol]:list-decimal [&>ol]:pl-6 [&>ol>li]:my-2 [&>ol>li]:pl-1 [&>ol>li::marker]:font-semibold [&>ol>li::marker]:text-primary-600">{children}</div>
    </section>
  );
}
