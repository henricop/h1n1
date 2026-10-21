import type { ReactNode } from 'react';

interface Props {
  id: string;
  label: string;
  title?: ReactNode;
  /** Rodapé de metadados (fonte · licença · base · método). */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Altura mínima reservada (evita layout shift enquanto gráficos carregam). */
  minHeight?: number;
}

/** Painel claro: rótulo discreto no topo, título em display, conteúdo e rodapé de metadados. */
export function Panel({ id, label, title, meta, className = '', children, minHeight }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-label`} className={`card relative p-5 ${className}`} style={minHeight ? { minHeight } : undefined}>
      <p id={`${id}-label`} className="label">
        {label}
      </p>
      {title && <h2 className="mt-1 font-display text-xl font-bold leading-snug tracking-[-0.01em] text-ink md:text-2xl">{title}</h2>}
      <div className="mt-3">{children}</div>
      {meta && <div className="meta">{meta}</div>}
    </section>
  );
}
