import type { Metadata } from 'next';
import type { ContentPage } from './content';
import { SITE } from './site';

/** Metadata de página editorial: title, description, canonical, robots conforme política, Open Graph. */
export function pageMetadata(page: ContentPage): Metadata {
  const fm = page.frontmatter;
  return {
    title: fm.title,
    description: fm.description,
    alternates: { canonical: fm.slug },
    robots: page.noindex ? { index: false, follow: true } : { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      title: fm.title,
      description: fm.description,
      url: fm.slug,
      siteName: SITE.name,
      locale: 'pt_BR',
      type: 'article',
      modifiedTime: fm.updated_at,
      authors: [fm.author],
    },
  };
}
