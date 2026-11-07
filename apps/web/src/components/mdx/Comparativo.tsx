import type { ReactNode } from 'react';
import styles from './editorial.module.css';
import { markVirus } from './mark';

interface Props {
  titulo?: string;
  colunas?: string[];
  linhas?: Array<{ rotulo: string; valores: Array<string | ReactNode> }>;
  nota?: string;
  /** Alternativa: tabela markdown escrita no MDX, renderizada dentro do invólucro responsivo. */
  children?: ReactNode;
}

/**
 * Tabela comparativa editorial: cabeçalho em mono, filetes finos, rolagem horizontal focável em telas estreitas
 * (região rotulada, para o teclado e o leitor de tela alcançarem). Estilos em editorial.module.css.
 */
export function Comparativo({ titulo, colunas = [], linhas, nota, children }: Props) {
  const label = titulo ?? 'Tabela comparativa';
  if (!linhas) {
    return (
      <div className={styles.tabela} role="region" aria-label={label} tabIndex={0}>
        {titulo && <p className={`${styles.serif} mb-3! mt-0! font-display text-[1.75rem] leading-[1.1] text-ink`}>{markVirus(titulo)}</p>}
        {children}
        {nota && <p className="mt-3 font-mono text-[14px] text-muted">{nota}</p>}
      </div>
    );
  }
  return (
    <div className={styles.tabela} role="region" aria-label={label} tabIndex={0}>
      <table>
        {titulo && <caption>{markVirus(titulo)}</caption>}
        <thead>
          <tr>
            <th scope="col">Aspecto</th>
            {colunas.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo}>
              <th scope="row">{l.rotulo}</th>
              {l.valores.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {nota && <p className="mt-3 font-mono text-[14px] text-muted">{nota}</p>}
    </div>
  );
}
