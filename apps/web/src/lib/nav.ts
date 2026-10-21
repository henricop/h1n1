import { buildNavigation, eligiblePages, type NavItem } from './content';

/**
 * Navegação primária (DESIGN.md v2). Os grupos editoriais (Sintomas, Vacina) só aparecem quando há página elegível:
 * o href vem da navegação derivada do conteúdo; sem página, o item fica de fora.
 */
export const PRIMARY_NAV: ReadonlyArray<{ label: string; href: string; group?: string }> = [
  { label: 'Entenda', href: '/o-que-e-h1n1/', group: 'Entenda o H1N1' },
  { label: 'Sintomas e cuidados', href: '', group: 'Sintomas e cuidados' },
  { label: 'Vacina e prevenção', href: '', group: 'Vacina e prevenção' },
  { label: 'Dados do Brasil', href: '/dados/brasil/' },
  { label: 'Sala de dados', href: '/sala/' },
  { label: 'Fontes', href: '/dados/fontes/' },
];

/** Resolve a navegação primária contra os grupos editoriais elegíveis. */
export function resolvePrimaryNav(nav: NavItem[]): Array<{ label: string; href: string }> {
  return PRIMARY_NAV.flatMap((item) => {
    if (!item.group) return [{ label: item.label, href: item.href }];
    const found = nav.find((n) => n.label === item.group);
    if (found) return [{ label: item.label, href: found.href }];
    return item.href ? [{ label: item.label, href: item.href }] : [];
  });
}


export interface SiteChrome {
  nav: NavItem[];
  institutional: Array<{ label: string; href: string }>;
}

const INSTITUTIONAL_ORDER = ['/sobre/equipe-e-revisao/', '/sobre/politica-editorial/', '/sobre/correcoes/', '/sobre/financiamento-e-publicidade/', '/contato/'];

/** Navegação e rodapé derivados das páginas de conteúdo elegíveis (sem conteúdo → só rotas de aplicação). */
export function siteChrome(): SiteChrome {
  const pages = eligiblePages();
  const nav = buildNavigation(pages);
  const sobre = pages.filter((p) => p.frontmatter.slug.startsWith('/sobre/') || p.frontmatter.slug === '/contato/');
  const institutional = sobre
    .sort((a, b) => {
      const ia = INSTITUTIONAL_ORDER.indexOf(a.frontmatter.slug);
      const ib = INSTITUTIONAL_ORDER.indexOf(b.frontmatter.slug);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.frontmatter.slug.localeCompare(b.frontmatter.slug);
    })
    .map((p) => ({ label: p.frontmatter.title, href: p.frontmatter.slug }));
  return { nav, institutional };
}
