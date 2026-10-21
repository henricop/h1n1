import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** Permite rastreamento de tudo; páginas noindex usam meta robots, não bloqueio aqui (seção 8.2). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
