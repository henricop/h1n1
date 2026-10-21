import type { MetadataRoute } from 'next';
import { eligiblePages } from '@/lib/content';
import { absoluteUrl } from '@/lib/site';

export const APP_ROUTES: ReadonlyArray<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/dados/brasil/', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/dados/fontes/', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/dados/metodologia/', priority: 0.7, changeFrequency: 'monthly' },
];

/** Apenas páginas indexáveis (elegíveis) + rotas de dados. Páginas em revisão ficam de fora. */
export function buildSitemap(pages = eligiblePages()): MetadataRoute.Sitemap {
  const app = APP_ROUTES.map((r) => ({ url: absoluteUrl(r.path), priority: r.priority, changeFrequency: r.changeFrequency }));
  const content = pages
    .filter((p) => p.eligible && !p.noindex && !APP_ROUTES.some((r) => r.path === p.frontmatter.slug))
    .map((p) => ({
      url: absoluteUrl(p.frontmatter.slug),
      lastModified: p.frontmatter.updated_at,
      priority: p.frontmatter.clinical ? 0.8 : 0.6,
      changeFrequency: 'monthly' as const,
    }));
  return [...app, ...content];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap();
}
