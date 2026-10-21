import type { MetadataRoute } from 'next';
import { getSources, type ApiResult, type SourceRow } from '@/lib/api';
import { eligiblePages } from '@/lib/content';
import { absoluteUrl } from '@/lib/site';

/** Regenera o sitemap no mesmo ritmo das páginas de dados (API_REVALIDATE_SECONDS; literal por exigência do Next). */
export const revalidate = 3600;

export const APP_ROUTES: ReadonlyArray<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/dados/brasil/', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/dados/mundo/', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/dados/fontes/', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/dados/metodologia/', priority: 0.7, changeFrequency: 'monthly' },
];

/**
 * Apenas páginas indexáveis (elegíveis) + rotas de dados + páginas de fonte do catálogo (via API).
 * Páginas em revisão ficam de fora. Se a API estiver indisponível, as fontes são omitidas sem quebrar.
 */
export function buildSitemap(pages = eligiblePages(), sources: ApiResult<{ data: SourceRow[] }> | null = null): MetadataRoute.Sitemap {
  const app = APP_ROUTES.map((r) => ({ url: absoluteUrl(r.path), priority: r.priority, changeFrequency: r.changeFrequency }));
  const content = pages
    .filter((p) => p.eligible && !p.noindex && !APP_ROUTES.some((r) => r.path === p.frontmatter.slug))
    .map((p) => ({
      url: absoluteUrl(p.frontmatter.slug),
      lastModified: p.frontmatter.updated_at,
      priority: p.frontmatter.clinical ? 0.8 : 0.6,
      changeFrequency: 'monthly' as const,
    }));
  const catalog = sources?.ok
    ? sources.data.data.map((s) => ({
        url: absoluteUrl(`/dados/fontes/${s.slug}/`),
        priority: 0.5,
        changeFrequency: 'monthly' as const,
      }))
    : [];
  return [...app, ...content, ...catalog];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sources = await getSources();
  return buildSitemap(eligiblePages(), sources);
}
