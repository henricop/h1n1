import type { ReactNode } from 'react';

/** Lista "o que isto não permite concluir" (regras 2, 3 e 7 de integridade). */
export function Limites({ children, titulo = 'O que isto não permite concluir' }: { children: ReactNode; titulo?: string }) {
  return (
    <section className="card-soft my-6 p-5">
      <h3 className="font-display text-lg font-bold text-ink">{titulo}</h3>
      <div className="mt-2 text-[0.95em] text-muted [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:my-1 [&>p]:my-2">{children}</div>
    </section>
  );
}
