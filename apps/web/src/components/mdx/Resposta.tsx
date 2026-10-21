import type { ReactNode } from 'react';

/** Caixa de resposta direta (acima da dobra ou dentro do corpo). */
export function Resposta({ children, titulo = 'Resposta direta' }: { children: ReactNode; titulo?: string }) {
  return (
    <aside className="my-6 rounded-[20px] border border-primary-100 bg-primary-50 p-5" aria-label={titulo}>
      <p className="kicker">{titulo}</p>
      <div className="mt-1 text-[1.05em] leading-relaxed [&>p]:my-2">{children}</div>
    </aside>
  );
}
