import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { resolvePrimaryNav } from '@/lib/nav';
import { SITE } from '@/lib/site';

/** @deprecated use `@/lib/nav` (o Header será removido pela frente A da reformulação v4). */
export { PRIMARY_NAV, resolvePrimaryNav } from '@/lib/nav';

export function Header({ nav }: { nav: NavItem[] }) {
  const items = resolvePrimaryNav(nav);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 md:px-6">
        <Link href="/" className="touch inline-flex items-center gap-2 no-underline" aria-label={`${SITE.name}: início`}>
          <span className="font-display text-2xl font-extrabold tracking-[-0.03em] text-primary-600">H1N1</span>
          <span className="hidden text-[13px] text-muted md:inline">informação clara, dados oficiais</span>
        </Link>
        <nav aria-label="Navegação principal" className="order-last w-full lg:order-none lg:w-auto">
          <ul className="-mx-1 flex flex-wrap gap-x-0.5 gap-y-0 text-[15px] font-medium">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="touch inline-flex items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-primary-50 hover:text-primary-700">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
