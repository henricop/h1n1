import type { ReactNode } from 'react';

interface Props {
  id: string;
  /** Numeral do capítulo: "01". */
  n: string;
  /** Kicker em mono: "Mundo". */
  kicker: string;
  children: ReactNode;
  /** Frase curta sob o título. */
  lead?: ReactNode;
  /** Elemento à direita (ex.: último valor). */
  aside?: ReactNode;
}

/** Cabeçalho de capítulo das páginas de dados: `( 01 ) Mundo` em mono + título em `.display-md`. */
export function SectionHead({ id, n, kicker, children, lead, aside }: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div className="max-w-3xl">
        <p className="kicker-mono text-[14px]!">
          ( {n} ) {kicker}
        </p>
        <h2 id={id} className="display-md mt-3">
          {children}
        </h2>
        {lead && <p className="mt-3 text-muted">{lead}</p>}
      </div>
      {aside}
    </header>
  );
}
