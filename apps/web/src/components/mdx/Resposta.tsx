import type { ReactNode } from 'react';

/** Caixa de resposta direta (acima da dobra ou dentro do corpo). */
export function Resposta({ children, titulo = 'Resposta direta' }: { children: ReactNode; titulo?: string }) {
  return (
    <aside className="my-6 rounded-md border-l-4 border-navy-700 bg-navy-50 p-4" aria-label={titulo}>
      <p className="text-xs font-semibold uppercase tracking-wide text-signal">{titulo}</p>
      <div className="mt-1 text-[1.05em] leading-relaxed [&>p]:my-2">{children}</div>
    </aside>
  );
}
