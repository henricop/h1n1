import type { ReactNode } from 'react';

/** Lista "o que isto não permite concluir" (regras 2, 3 e 7 de integridade). */
export function Limites({ children, titulo = 'O que isto não permite concluir' }: { children: ReactNode; titulo?: string }) {
  return (
    <section className="my-6 rounded-md border border-line bg-paper p-4">
      <h3 className="text-base font-semibold text-navy-900">{titulo}</h3>
      <div className="mt-2 text-[0.95em] text-muted [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:my-1 [&>p]:my-2">{children}</div>
    </section>
  );
}
