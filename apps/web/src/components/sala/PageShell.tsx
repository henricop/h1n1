import type { ReactNode } from 'react';

/**
 * Contêiner das páginas de dados: o `main` do shell é largura total, então cada página traz o seu `max-w-6xl`
 * e o espaço superior para a marca e a pílula Menu fixas (5 rem no celular, 6 rem no desktop).
 */
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-20 md:px-8 md:pt-24">{children}</div>;
}
