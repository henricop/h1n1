import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPage, loadAllPages, normalizeSlug } from '@/lib/content';
import { pageMetadata } from '@/lib/metadata';
import { MdxArticle } from '@/components/MdxArticle';

/** Slugs atendidos por rotas de aplicação (não passam pelo catch-all). */
const APP_SLUGS = new Set(['/sala/', '/dados/brasil/', '/dados/mundo/', '/dados/fontes/', '/dados/metodologia/']);

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): Array<{ slug: string[] }> {
  return loadAllPages()
    .filter((p) => !APP_SLUGS.has(p.frontmatter.slug))
    .map((p) => ({ slug: p.frontmatter.slug.split('/').filter(Boolean) }));
}

type Params = Promise<{ slug: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page) return { title: 'Página não encontrada', robots: { index: false, follow: false } };
  return pageMetadata(page);
}

export default async function ContentPage({ params }: { params: Params }) {
  const { slug } = await params;
  const s = normalizeSlug(slug);
  if (APP_SLUGS.has(s)) notFound();
  const page = getPage(s);
  if (!page) notFound();
  return <MdxArticle page={page} />;
}
