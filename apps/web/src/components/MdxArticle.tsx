import Link from 'next/link';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import type { ContentPage } from '@/lib/content';
import { breadcrumbsFor, loadAllPages } from '@/lib/content';
import { formatDateBR } from '@/lib/format';
import { mdxComponents } from '@/components/mdx';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ClinicalNotice, ReviewBanner } from '@/components/Notices';

/**
 * Template único de página editorial: breadcrumb, resposta curta, corpo, fontes numeradas,
 * autoria/revisão, relacionados. Sem data de publicação em destaque, tags ou "posts recentes".
 */
export async function MdxArticle({ page, children }: { page: ContentPage; children?: React.ReactNode }) {
  const fm = page.frontmatter;
  const all = loadAllPages();
  const { content } = await compileMDX({
    source: page.body,
    components: mdxComponents,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
  });
  const related = fm.related
    .map((slug) => all.find((p) => p.frontmatter.slug === slug && p.eligible))
    .filter((p): p is ContentPage => !!p);

  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumb items={breadcrumbsFor(fm.slug, all)} />
      {page.underReview && (
        <div className="mt-3">
          <ReviewBanner />
        </div>
      )}
      <header className="mt-4">
        <h1 className="text-3xl font-bold leading-tight text-navy-900 sm:text-4xl">{fm.title}</h1>
        <p className="mt-3 rounded-md border-l-4 border-navy-700 bg-navy-50 p-4 text-lg leading-relaxed text-navy-950" data-summary-answer>
          {fm.summary_answer}
        </p>
        {fm.clinical && (
          <div className="mt-3">
            <ClinicalNotice />
          </div>
        )}
      </header>

      <div className="prose mt-6">{content}</div>
      {children}

      {fm.sources.length > 0 && (
        <section aria-labelledby="h-fontes" className="mt-10 border-t border-line pt-6">
          <h2 id="h-fontes" className="text-xl font-semibold text-navy-900">
            Fontes
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm">
            {fm.sources.map((s, i) => (
              <li key={`${s.url}-${i}`} id={s.id ? `fonte-${s.id}` : undefined}>
                <a href={s.url} rel="noopener noreferrer" target="_blank">
                  {s.title}
                </a>
                <span className="text-muted"> (acesso em {formatDateBR(s.accessed_at)})</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="h-autoria" className="mt-8 rounded-md border border-line bg-paper p-4 text-sm">
        <h2 id="h-autoria" className="font-semibold text-navy-900">
          Autoria e revisão
        </h2>
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium">Autor</dt>
          <dd>{fm.author}</dd>
          <dt className="font-medium">Revisão clínica</dt>
          <dd>{fm.reviewer && fm.review_status === 'reviewed' ? `${fm.reviewer}, em ${formatDateBR(fm.reviewed_at)}` : 'Sem revisão clínica até o momento'}</dd>
          <dt className="font-medium">Atualizado em</dt>
          <dd>{formatDateBR(fm.updated_at)}</dd>
        </dl>
      </section>

      {related.length > 0 && (
        <nav aria-labelledby="h-rel" className="mt-8">
          <h2 id="h-rel" className="text-xl font-semibold text-navy-900">
            Leia também
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((p) => (
              <li key={p.frontmatter.slug}>
                <Link href={p.frontmatter.slug} className="touch flex rounded-md border border-line bg-paper px-4 py-3 no-underline hover:border-navy-600">
                  <span>
                    <span className="font-medium text-navy-900">{p.frontmatter.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{p.frontmatter.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
