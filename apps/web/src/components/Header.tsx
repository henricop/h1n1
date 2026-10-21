import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { SITE } from '@/lib/site';

export function Header({ nav }: { nav: NavItem[] }) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="touch inline-flex items-center gap-2 no-underline" aria-label={`${SITE.name}: página inicial`}>
          <span className="rounded bg-navy-900 px-2 py-1 text-lg font-bold tracking-tight text-white">H1N1</span>
          <span className="hidden text-sm text-muted sm:inline">{SITE.tagline}</span>
        </Link>
        <nav aria-label="Navegação principal" className="w-full sm:w-auto">
          <ul className="-mx-1 flex flex-wrap gap-x-1 gap-y-0 text-[15px]">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="touch inline-flex items-center rounded px-3 py-2 font-medium text-navy-900 no-underline hover:bg-navy-50">
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
