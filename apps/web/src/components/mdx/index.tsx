import type { MDXComponents } from 'mdx/types';
import { Resposta } from './Resposta';
import { Alerta } from './Alerta';
import { Limites } from './Limites';
import { Fato } from './Fato';
import { Indicador } from './Indicador';
import { Glossario } from './Glossario';
import { Comparativo } from './Comparativo';
import { LinhaDoTempo } from './LinhaDoTempo';
import { Passos } from './Passos';
import { markVirus } from './mark';

/** Componentes disponíveis ao conteúdo MDX (content/pages/**.mdx). */
export const mdxComponents: MDXComponents = {
  Resposta,
  Alerta,
  Limites,
  Fato,
  Indicador,
  Glossario,
  Comparativo,
  LinhaDoTempo,
  Passos,
  h2: ({ children, ...props }) => <h2 {...props}>{markVirus(children)}</h2>,
  h3: ({ children, ...props }) => <h3 {...props}>{markVirus(children)}</h3>,
  a: (props) => {
    const external = typeof props.href === 'string' && /^https?:\/\//.test(props.href);
    return external ? <a {...props} rel="noopener noreferrer" target="_blank" /> : <a {...props} />;
  },
};
