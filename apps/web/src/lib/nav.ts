import { buildNavigation, eligiblePages, type NavItem } from './content';

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
