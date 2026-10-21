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
    <article className="mx-auto max-w-3xl py-4 md:py-8">
      <Breadcrumb items={breadcrumbsFor(fm.slug, all)} />
      {page.underReview && (
        <div className="mt-3">
          <ReviewBanner />
        </div>
      )}
      <header className="mt-4">
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">{fm.title}</h1>
        <p className="mt-6 rounded-[20px] border border-primary-100 bg-primary-50 p-5 text-lg leading-relaxed text-ink md:text-xl" data-summary-answer>
          {fm.summary_answer}
        </p>
        {fm.clinical && (
          <div className="mt-3">
            <ClinicalNotice />
          </div>
        )}
      </header>

      <div className="prose mt-10">{content}</div>
      {children}

      {fm.sources.length > 0 && (
        <section aria-labelledby="h-fontes" className="mt-10 border-t border-line pt-6">
          <h2 id="h-fontes" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
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

      <section aria-labelledby="h-autoria" className="card-soft mt-10 p-5 text-[15px]">
        <h2 id="h-autoria" className="font-semibold text-ink">
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
          <h2 id="h-rel" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            Leia também
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((p) => (
              <li key={p.frontmatter.slug}>
                <Link href={p.frontmatter.slug} className="card touch flex px-5 py-4 no-underline hover:border-primary-600">
                  <span>
                    <span className="font-medium text-ink">{p.frontmatter.title}</span>
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
