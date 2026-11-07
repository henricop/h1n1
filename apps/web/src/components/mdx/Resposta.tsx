import type { ReactNode } from 'react';
import styles from './editorial.module.css';
import { markVirus } from './mark';

/**
 * Resposta direta: pull-quote em serifa itálica com filete à esquerda (sem cartão). O texto vem do MDX; os <Fato>
 * dentro dela voltam à sans em bloco (ver `.resposta :global(.fato)` em editorial.module.css).
 */
export function Resposta({ children, titulo = 'Resposta direta' }: { children: ReactNode; titulo?: string }) {
  return (
    <div role="group" aria-label={titulo} className={`${styles.resposta} my-12 border-l-2 border-ink pl-5 md:my-16 md:pl-8`}>
      <p className="font-mono text-[14px] leading-none text-muted">
        <span aria-hidden="true">[ </span>
        {titulo.toLowerCase()}
        <span aria-hidden="true"> ]</span>
      </p>
      <div className="lead mt-4 [&>p]:my-4! [&>p:first-child]:mt-0! [&>p:last-child]:mb-0!">{markVirus(children)}</div>
    </div>
  );
}
