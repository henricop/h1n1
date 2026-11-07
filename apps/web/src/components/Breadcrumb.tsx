import Link from 'next/link';
import { JsonLd } from './JsonLd';
import { absoluteUrl } from '@/lib/site';

export interface Crumb {
  label: string;
  href: string | null;
}

/**
 * Trilha de navegação VISÍVEL acima do H1 das páginas internas (o shell não tem barra de navegação): ≥ 15 px, cor
 * `muted`, alvos ≥ 44 px, página atual com `aria-current="page"` (truncada visualmente se longa; o texto completo
 * fica no título). Inclui BreadcrumbList em JSON-LD.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  const linked = items.filter((c): c is { label: string; href: string } => c.href !== null);
  return (
    <nav aria-label="Trilha de navegação" className="text-[15px] text-muted">
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-x-2">
              {i > 0 && (
                <span aria-hidden="true" className="font-mono text-faint">
                  /
                </span>
              )}
              {c.href && !last ? (
                <Link href={c.href} title={c.label} className="touch inline-flex max-w-[12rem] items-center text-muted underline-offset-4 hover:text-ink sm:max-w-[16rem] md:max-w-[22rem]">
                  <span className="min-w-0 truncate">{c.label}</span>
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} title={c.label} className="inline-flex min-h-11 max-w-[15rem] items-center truncate text-ink sm:max-w-[26rem] md:max-w-[34rem]">
                  <span className="min-w-0 truncate">{c.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: linked.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: absoluteUrl(c.href) })),
        }}
      />
    </nav>
  );
}
