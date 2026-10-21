import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { SITE } from '@/lib/site';

/**
 * Navegação primária (DESIGN.md v2). Os grupos editoriais (Sintomas, Vacina) só aparecem quando há página elegível:
 * o href vem da navegação derivada do conteúdo; sem página, o item fica de fora.
 */
export const PRIMARY_NAV: ReadonlyArray<{ label: string; href: string; group?: string }> = [
  { label: 'Entenda', href: '/o-que-e-h1n1/', group: 'Entenda o H1N1' },
  { label: 'Sintomas e cuidados', href: '', group: 'Sintomas e cuidados' },
  { label: 'Vacina e prevenção', href: '', group: 'Vacina e prevenção' },
  { label: 'Dados do Brasil', href: '/dados/brasil/' },
  { label: 'Sala de dados', href: '/sala/' },
  { label: 'Fontes', href: '/dados/fontes/' },
];

/** Resolve a navegação primária contra os grupos editoriais elegíveis. */
export function resolvePrimaryNav(nav: NavItem[]): Array<{ label: string; href: string }> {
  return PRIMARY_NAV.flatMap((item) => {
    if (!item.group) return [{ label: item.label, href: item.href }];
    const found = nav.find((n) => n.label === item.group);
    if (found) return [{ label: item.label, href: found.href }];
    return item.href ? [{ label: item.label, href: item.href }] : [];
  });
}

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
