import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { SITE } from '@/lib/site';
import { CommandPaletteButton } from '@/components/sala/CommandPaletteButton';

/** Navegação primária fixa do HUD; grupos editoriais elegíveis (sintomas, vacina…) entram em seguida. */
export const PRIMARY_NAV: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Sala de Situação', href: '/' },
  { label: 'Dados Brasil', href: '/dados/brasil/' },
  { label: 'Mundo', href: '/dados/mundo/' },
  { label: 'Terminal', href: '/terminal/' },
  { label: 'Entenda o H1N1', href: '/o-que-e-h1n1/' },
  { label: 'Fontes', href: '/dados/fontes/' },
  { label: 'Metodologia', href: '/dados/metodologia/' },
];

export function Header({ nav }: { nav: NavItem[] }) {
  const primaryHrefs = new Set(PRIMARY_NAV.map((p) => p.href));
  const entenda = nav.find((n) => n.label === 'Entenda o H1N1');
  const primary = PRIMARY_NAV.map((p) => (p.label === 'Entenda o H1N1' && entenda ? { ...p, href: entenda.href } : p));
  const editorial = nav.filter((n) => !primaryHrefs.has(n.href) && n.label !== 'Entenda o H1N1' && n.label !== 'H1N1 hoje' && n.label !== 'Dados e pesquisas');
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2">
        <Link href="/" className="touch inline-flex items-center gap-2 no-underline" aria-label={`${SITE.name}: sala de situação`}>
          <span className="rounded border border-h1n1/60 bg-h1n1/10 px-2 py-0.5 font-display text-base font-bold tracking-tight text-h1n1 glow-h1n1">H1N1</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-faint md:inline">sala de situação</span>
        </Link>
        <nav aria-label="Navegação principal" className="order-last w-full md:order-none md:w-auto">
          <ul className="-mx-1 flex flex-wrap gap-x-0.5 gap-y-0 font-mono text-[12px] uppercase tracking-wider">
            {primary.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="touch inline-flex items-center rounded px-2.5 py-2 text-muted no-underline hover:bg-bg-800 hover:text-signal">
                  {item.label}
                </Link>
              </li>
            ))}
            {editorial.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="touch inline-flex items-center rounded px-2.5 py-2 text-muted no-underline hover:bg-bg-800 hover:text-signal">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <CommandPaletteButton className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
