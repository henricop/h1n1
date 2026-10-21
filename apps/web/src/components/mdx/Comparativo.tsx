import type { ReactNode } from 'react';

interface Props {
  titulo?: string;
  colunas?: string[];
  linhas?: Array<{ rotulo: string; valores: Array<string | ReactNode> }>;
  nota?: string;
  /** Alternativa: tabela markdown escrita no MDX, renderizada dentro do invólucro responsivo. */
  children?: ReactNode;
}

/** Tabela comparativa responsiva com cabeçalho acessível (rolagem horizontal em telas estreitas). */
export function Comparativo({ titulo, colunas = [], linhas, nota, children }: Props) {
  if (!linhas) {
    return (
      <div className="my-6 overflow-x-auto [&>table]:data-table [&_th]:text-left [&_td]:align-top">
        {titulo && <p className="font-medium text-ink">{titulo}</p>}
        {children}
        {nota && <p className="mt-2 text-xs text-muted">{nota}</p>}
      </div>
    );
  }
  return (
    <div className="my-6 overflow-x-auto">
      <table className="data-table">
        <caption className="font-medium text-ink">{titulo}</caption>
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
              <th scope="row" className="font-medium">
                {l.rotulo}
              </th>
              {l.valores.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {nota && <p className="mt-2 text-xs text-muted">{nota}</p>}
    </div>
  );
}
