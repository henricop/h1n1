import Link from 'next/link';
import type { CSSProperties } from 'react';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import type { ContentPage, NavGroup } from '@/lib/content';
import { breadcrumbsFor, loadAllPages } from '@/lib/content';
import { formatDateBR } from '@/lib/format';
import { mdxComponents } from '@/components/mdx';
import { ArticleToc } from '@/components/mdx/ArticleToc';
import { ARTICLE_GRID, FRAME, FRAME_TOP, KICKER, SECTION_TITLE } from '@/components/mdx/frame';
import { rehypeArticleHeadings, type ArticleHeading } from '@/components/mdx/headings';
import { markVirus, SERIF_CLASS } from '@/components/mdx/mark';
import { RevealHeadings } from '@/components/mdx/RevealHeadings';
import { SourceTitle } from '@/components/mdx/SourceTitle';
import styles from '@/components/mdx/editorial.module.css';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ClinicalNotice, ReviewBanner } from '@/components/Notices';

/** Rótulo editorial do grupo (kicker acima do título). Mesmos nomes da navegação do site. */
export const GROUP_LABEL: Record<NavGroup, string> = {
  entenda: 'Entenda o H1N1',
  sintomas: 'Sintomas e cuidados',
  vacina: 'Vacina e prevenção',
  dados: 'Dados e pesquisas',
  sobre: 'Sobre o projeto',
};

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

/** Títulos longos (páginas de SEO) ganham uma escala um pouco menor para não ocupar a tela inteira. */
function titleStyle(title: string): CSSProperties | undefined {
  return title.length > 56 ? { fontSize: 'clamp(2.25rem, 1.1rem + 3.4vw, 4.75rem)' } : undefined;
}

/**
 * Template único de página editorial (revista): breadcrumb visível, kicker mono, H1 em Instrument Serif, resposta
 * como pull-quote, faixa de avisos, corpo em 64ch com sumário lateral fixo, fontes como notas numeradas, autoria
 * e revisão em mono e "Leia também" em tipografia grande. Sem data de publicação em destaque, tags ou "posts
 * recentes". `extraHeadings` inclui no sumário seções que a página injeta em `children` (ex.: metodologia).
 */
export async function MdxArticle({ page, children, extraHeadings = [] }: { page: ContentPage; children?: React.ReactNode; extraHeadings?: ArticleHeading[] }) {
  const fm = page.frontmatter;
  const all = loadAllPages();
  const bodyHeadings: ArticleHeading[] = [];
  const { content } = await compileMDX({
    source: page.body,
    components: mdxComponents,
    options: { mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeArticleHeadings(bodyHeadings)] } },
  });
  const related = fm.related
    .map((slug) => all.find((p) => p.frontmatter.slug === slug && p.eligible))
    .filter((p): p is ContentPage => !!p);

  const toc: ArticleHeading[] = [...bodyHeadings, ...extraHeadings, ...(fm.sources.length > 0 ? [{ id: 'h-fontes', text: 'Fontes' }] : [])];
  const showToc = toc.length > 1;
  const group = fm.nav_group ? GROUP_LABEL[fm.nav_group] : 'H1N1';
  const notices = page.underReview || fm.clinical;

  return (
    <article className={styles.article}>
      <RevealHeadings />
      <header className={`${FRAME} ${FRAME_TOP} pb-12 md:pb-20`}>
        <Breadcrumb items={breadcrumbsFor(fm.slug, all)} />
        <p className={`${KICKER} ${styles.rise} mt-8 md:mt-12`} style={delay(60)}>
          <span aria-hidden="true">[ </span>
          {group}
          <span aria-hidden="true"> ]</span>
        </p>
        <h1 className={`display-lg ${styles.rise} mt-5 max-w-5xl text-balance`} style={{ ...titleStyle(fm.title), ...delay(140) }}>
          {markVirus(fm.title)}
        </h1>
        <p
          data-summary-answer
          className={`${styles.rise} ${SERIF_CLASS} mt-10 max-w-3xl border-l-2 border-ink pl-5 font-display text-[clamp(1.5rem,1rem+1.6vw,2.25rem)] italic leading-[1.2] text-ink md:mt-14 md:pl-8`}
          style={delay(260)}
        >
          {markVirus(fm.summary_answer)}
        </p>
      </header>

      {notices && (
        <div className="border-y border-line bg-bg-soft">
          <div className={`${FRAME} grid gap-6 py-6 md:py-8 ${page.underReview && fm.clinical ? 'lg:grid-cols-2 lg:gap-12' : ''}`}>
            {page.underReview && <ReviewBanner />}
            {fm.clinical && <ClinicalNotice />}
          </div>
        </div>
      )}

      <div className={`${FRAME} py-16 md:py-24 ${showToc ? ARTICLE_GRID : ''}`}>
        <div className="min-w-0">
          {showToc && (
            <details className="group mb-12 border-y border-line lg:hidden">
              <summary className={`touch flex cursor-pointer list-none items-center justify-between py-3 [&::-webkit-details-marker]:hidden ${KICKER}`}>
                <span>
                  <span aria-hidden="true">[ </span>nesta página<span aria-hidden="true"> ]</span>
                </span>
                <span aria-hidden="true" className="text-lg transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <ol className="pb-3">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="touch flex items-center py-1 text-[16px] leading-snug text-ink no-underline">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <div className="prose">{content}</div>
          {children}
        </div>
        {showToc && (
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <ArticleToc items={toc} />
            </div>
          </div>
        )}
      </div>

      {fm.sources.length > 0 && (
        <section aria-labelledby="h-fontes" className="border-t border-line">
          <div className={`${FRAME} py-16 md:py-24`}>
            <h2 id="h-fontes" className={`${SECTION_TITLE} scroll-mt-24`}>
              Fontes
            </h2>
            <ol className={`${styles.notas} mt-10 max-w-4xl font-mono text-[14px] leading-relaxed`}>
              {fm.sources.map((s, i) => (
                <li key={`${s.url}-${i}`} id={s.id ? `fonte-${s.id}` : undefined}>
                  <a href={s.url} rel="noopener noreferrer" target="_blank">
                    <SourceTitle title={s.title} />
                  </a>
                  <span className="block text-muted">
                    acesso em {formatDateBR(s.accessed_at)}
                    {s.id ? (
                      <>
                        {' · '}catálogo{' '}
                        <Link href={`/dados/fontes/${s.id}/`} aria-label={`Ver ${s.id} no catálogo de fontes`}>
                          {s.id}
                        </Link>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section aria-labelledby="h-autoria" className="border-t border-line">
        <div className={`${FRAME} py-16 md:py-24`}>
          <h2 id="h-autoria" className={SECTION_TITLE}>
            Autoria e revisão
          </h2>
          <dl className="mt-10 grid max-w-4xl gap-x-12 gap-y-4 font-mono text-[14px] leading-relaxed sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted">autoria</dt>
            <dd>{fm.author}</dd>
            <dt className="text-muted">revisão clínica</dt>
            <dd>{fm.reviewer && fm.review_status === 'reviewed' ? `${fm.reviewer}, em ${formatDateBR(fm.reviewed_at)}` : 'Sem revisão clínica até o momento'}</dd>
            <dt className="text-muted">atualizado em</dt>
            <dd>{formatDateBR(fm.updated_at)}</dd>
          </dl>
        </div>
      </section>

      {related.length > 0 && (
        <nav aria-labelledby="h-rel" className="border-t border-line">
          <div className={`${FRAME} py-16 md:py-24`}>
            <h2 id="h-rel" className={SECTION_TITLE}>
              Leia também
            </h2>
            <ul className="mt-12 grid gap-x-14 md:grid-cols-2">
              {related.map((p) => (
                <li key={p.frontmatter.slug}>
                  <Link href={p.frontmatter.slug} className="group block border-t border-ink py-8 text-ink no-underline">
                    <span className="display-md block text-balance group-hover:underline group-focus-visible:underline">{markVirus(p.frontmatter.title)}</span>
                    <span className="mt-4 block text-[17px] leading-relaxed text-muted">{p.frontmatter.description}</span>
                    <span aria-hidden="true" className="mt-5 block font-mono text-[14px] text-ink">
                      ler →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </article>
  );
}
