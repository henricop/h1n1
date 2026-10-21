import Link from 'next/link';
import { JsonLd } from './JsonLd';
import { absoluteUrl } from '@/lib/site';

export interface Crumb {
  label: string;
  href: string | null;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const linked = items.filter((c): c is { label: string; href: string } => c.href !== null);
  return (
    <nav aria-label="Trilha de navegação" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-x-1">
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.href && !last ? (
                <Link href={c.href} className="touch inline-flex items-center py-2">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="py-2">
                  {c.label}
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
