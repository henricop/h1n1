import type { ReactNode } from 'react';
import styles from './editorial.module.css';
import { markVirus } from './mark';

/** Título padrão da seção obrigatória (README do conteúdo, regras 2, 3 e 7 de integridade). */
export const LIMITES_TITULO = 'O que esta página não permite concluir';
export const LIMITES_ID = 'limites';

/**
 * Seção "O que esta página não permite concluir": kicker mono e título em serifa, faixa de papel (sem cartão).
 * `id` é injetado pelo plugin de títulos (headings.ts) para o sumário lateral apontar para cá.
 */
export function Limites({ children, titulo = LIMITES_TITULO, id = LIMITES_ID }: { children: ReactNode; titulo?: string; id?: string }) {
  return (
    <section aria-labelledby={id} className="my-16 border-t border-ink pt-6 md:my-24">
      <p className="font-mono text-[14px] leading-none text-muted">
        <span aria-hidden="true">[ </span>limites<span aria-hidden="true"> ]</span>
      </p>
      <h2 id={id} className={`${styles.serif} mb-6! mt-4! scroll-mt-24 font-display text-[1.875rem] leading-[1.05] tracking-[-0.01em] text-ink md:text-4xl`}>
        {markVirus(titulo)}
      </h2>
      <div className="text-ink [&>p]:my-3! [&>ul]:my-3! [&>ul]:list-disc [&>ul]:pl-6 [&>ul>li]:my-2!">{children}</div>
    </section>
  );
}
