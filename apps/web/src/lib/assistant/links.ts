/**
 * Política de links do assistente (puro, testado): o modelo só pode linkar rotas internas do site ou URLs que
 * vieram como citação de uma ferramenta nesta conversa. Nada de javascript:, //host, \ ou esquemas externos inventados.
 */

import { isInternalRoute as parserInternalRoute } from '@/lib/terminal/parser';

/** Rota interna: começa com uma barra, só minúsculas/dígitos/hífen/barra e query simples (mesma regra do `abrir` do terminal). */
export function isInternalRoute(url: string): boolean {
  return typeof url === 'string' && parserInternalRoute(url);
}

/** Citações das ferramentas podem ser internas ou https:// (catálogo de fontes oficiais vindo do servidor). */
export function isCitationUrl(url: string): boolean {
  if (isInternalRoute(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !!u.hostname;
  } catch {
    return false;
  }
}

/** Link escrito pelo modelo: permitido se for rota interna ou coincidir exatamente com uma citação de ferramenta. */
export function isAllowedModelLink(url: string, citationUrls: ReadonlySet<string> | readonly string[]): boolean {
  if (isInternalRoute(url)) return true;
  const set = citationUrls instanceof Set ? citationUrls : new Set(citationUrls);
  return set.has(url) && isCitationUrl(url);
}
