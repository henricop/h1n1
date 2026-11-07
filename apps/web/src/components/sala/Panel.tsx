import type { ReactNode } from 'react';
import { LABEL, META } from '@/components/charts/ui';

interface Props {
  id: string;
  label: string;
  title?: ReactNode;
  /** Rodapé de metadados (fonte · licença · base de · método), em mono. */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Altura mínima reservada (evita layout shift enquanto gráficos carregam). */
  minHeight?: number;
}

/** Painel de DADO sobre papel: rótulo mono no topo, título em serifa (h3), conteúdo e rodapé de metadados. */
export function Panel({ id, label, title, meta, className = '', children, minHeight }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-label`} className={`card relative p-5 md:p-7 ${className}`} style={minHeight ? { minHeight } : undefined}>
      <p id={`${id}-label`} className={LABEL}>
        {label}
      </p>
      {title && <h3 className="mt-2 font-display text-[1.75rem] font-normal leading-[1.1] tracking-[-0.01em] text-ink">{title}</h3>}
      <div className="mt-5">{children}</div>
      {meta && <div className={META}>{meta}</div>}
    </section>
  );
}
