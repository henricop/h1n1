import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import styles from './editorial.module.css';

/**
 * Em Instrument Serif (romano e itálico) o algarismo "1" é quase igual ao "l" minúsculo: "H1N1" lê-se "HlNl".
 * Em contextos de serifa (títulos, pull-quotes) o token "H1N1" ganha um <span> que a CSS (editorial.module.css:
 * `.mark`) troca para a condensada da marca (Big Shoulders), sem ambiguidade. Em texto de corpo (Inter) o <span>
 * não altera nada. O texto continua "H1N1" para busca, cópia e leitor de tela.
 */
const TOKEN = /(H1N1)/g;

/** Classe para o contêiner de serifa que NÃO usa `.display-*`/`.lead`/`.prose h2` (ver editorial.module.css). */
export const SERIF_CLASS: string = styles.serif ?? '';

/** Envolve "H1N1" em strings e, recursivamente, em elementos HTML (tipo string); componentes ficam como estão. */
export function markVirus(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    if (!node.includes('H1N1')) return node;
    return node.split(TOKEN).map((part, i) =>
      part === 'H1N1' ? (
        <span key={i} className={styles.mark}>
          H1N1
        </span>
      ) : (
        part
      ),
    );
  }
  if (Array.isArray(node)) return Children.map(node, markVirus);
  if (isValidElement<{ children?: ReactNode }>(node) && typeof node.type === 'string' && node.props.children != null) {
    return cloneElement(node, undefined, markVirus(node.props.children));
  }
  return node;
}
