/**
 * Tipos e helpers de link seguros no CLIENTE (sem importar `@/lib/nav`/`@/lib/content`, que usam `node:fs`).
 * `destinations.ts` (servidor) re-exporta daqui; Menu/TopLinks importam deste módulo.
 */
export const ALERT_HREF = '/sintomas/sinais-de-alerta/';
export const TRANSMISSION_HREF = '/transmissao/';
export const WORLD_HREF = '/dados/mundo/';

export interface ShellLink {
  label: string;
  href: string;
}

/** O link aponta para a página atual? (compara sem barra final) */
export function isCurrentPath(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const norm = (s: string) => (s.length > 1 ? s.replace(/\/+$/, '') : s);
  return norm(pathname) === norm(href);
}
