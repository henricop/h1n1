/**
 * Destinos do shell (Menu, atalhos do topo, rodapé) derivados da navegação elegível (`siteChrome()` em
 * `@/lib/nav`). Puro e seguro no servidor: o layout calcula e passa por props aos componentes cliente.
 *
 * Ordem por necessidade (docs/reformulacao-v4.md §6): Sinais de alerta · Sintomas e cuidados · Vacina e
 * prevenção · Como se transmite · Entenda o H1N1 · Dados do Brasil · Sala de dados · Fontes e metodologia.
 * Itens sem página elegível somem; hrefs repetidos aparecem uma vez só (o primeiro rótulo vence).
 */
import type { NavItem } from '@/lib/content';
import { resolvePrimaryNav } from '@/lib/nav';
import { ALERT_HREF, TRANSMISSION_HREF, WORLD_HREF, isCurrentPath, type ShellLink } from './links';

export { ALERT_HREF, TRANSMISSION_HREF, WORLD_HREF, isCurrentPath, type ShellLink };


/** A página existe na navegação elegível (item de topo ou filho de grupo)? */
export function navHas(nav: readonly NavItem[], href: string): boolean {
  return nav.some((n) => n.href === href || n.children.some((c) => c.href === href));
}

function collector() {
  const out: ShellLink[] = [];
  const push = (label: string, href: string | null | undefined) => {
    if (href && !out.some((o) => o.href === href)) out.push({ label, href });
  };
  return { out, push };
}

/** Destinos primários do Menu, na ordem do contrato. */
export function menuDestinations(nav: NavItem[]): ShellLink[] {
  const primary = resolvePrimaryNav(nav);
  const hrefOf = (label: string) => primary.find((p) => p.label === label)?.href;
  const { out, push } = collector();
  if (navHas(nav, ALERT_HREF)) push('Sinais de alerta', ALERT_HREF);
  push('Sintomas e cuidados', hrefOf('Sintomas e cuidados'));
  push('Vacina e prevenção', hrefOf('Vacina e prevenção'));
  if (navHas(nav, TRANSMISSION_HREF)) push('Como se transmite', TRANSMISSION_HREF);
  push('Entenda o H1N1', hrefOf('Entenda'));
  push('Dados do Brasil', hrefOf('Dados do Brasil'));
  push('Sala de dados', hrefOf('Sala de dados'));
  push('Fontes e metodologia', hrefOf('Fontes'));
  return out;
}

/** Atalhos textuais ao lado do Menu nas páginas internas (a partir de `lg`): Sinais de alerta · Vacina · Dados. */
export function topShortcuts(nav: NavItem[]): ShellLink[] {
  const d = menuDestinations(nav);
  const pick = (label: string, short: string): ShellLink[] => {
    const found = d.find((x) => x.label === label);
    return found ? [{ label: short, href: found.href }] : [];
  };
  return [...pick('Sinais de alerta', 'Sinais de alerta'), ...pick('Vacina e prevenção', 'Vacina'), ...pick('Dados do Brasil', 'Dados')];
}

/** Seções do rodapé: os destinos do Menu (menos "Fontes e metodologia", que vai para Transparência) + mundo. */
export function footerSections(nav: NavItem[]): ShellLink[] {
  const { out, push } = collector();
  for (const d of menuDestinations(nav)) {
    if (d.label === 'Fontes e metodologia') continue;
    push(d.label, d.href);
    if (d.label === 'Dados do Brasil') push('H1N1 no mundo', WORLD_HREF);
  }
  push('H1N1 no mundo', WORLD_HREF);
  return out;
}

/** Rótulo curto de um título editorial: o trecho antes de ":" ("Equipe e revisão: quem faz…" → "Equipe e revisão"). */
export function shortTitle(title: string): string {
  const head = title.split(':')[0]!.trim();
  return head || title;
}

/** Institucionais com rótulo curto (Menu e rodapé). */
export function institutionalLinks(institutional: readonly ShellLink[]): ShellLink[] {
  const { out, push } = collector();
  for (const i of institutional) push(shortTitle(i.label), i.href);
  return out;
}

/** Transparência no rodapé: fontes, metodologia e as páginas institucionais elegíveis (`/sobre/*`, `/contato/`). */
export function footerTransparency(institutional: readonly ShellLink[]): ShellLink[] {
  const { out, push } = collector();
  push('Fontes oficiais', '/dados/fontes/');
  push('Metodologia', '/dados/metodologia/');
  for (const i of institutionalLinks(institutional)) push(i.label, i.href);
  return out;
}
