import type { ReactNode } from 'react';
import styles from './editorial.module.css';
import { markVirus } from './mark';

/** Lista numerada de passos: numerais em condensada grande, filetes entre itens. Filhos: um <ol> (markdown). */
export function Passos({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className={styles.passos} role="group" aria-label={titulo ?? 'Passos'}>
      {titulo && <h3 className={`${styles.serif} mb-4! mt-0! font-display text-[1.75rem] leading-[1.1] tracking-[-0.01em] text-ink md:text-3xl`}>{markVirus(titulo)}</h3>}
      {children}
    </div>
  );
}
