'use client';
/**
 * Atalhos textuais ao lado da pílula Menu, só nas páginas internas e a partir de `lg` (docs/reformulacao-v4.md §6):
 * Sinais de alerta · Vacina · Dados. Sem fundo de barra: cada link é uma etiqueta de papel claro opaco (legível
 * sobre qualquer tema), alvo ≥ 44 px. A home continua sem eles.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isCurrentPath, type ShellLink } from './links';
import { UI } from './paper';

export function TopLinks({ links }: { links: readonly ShellLink[] }) {
  const pathname = usePathname();
  if (links.length === 0 || !pathname || pathname === '/') return null;
  return (
    <nav aria-label="Atalhos" className="pointer-events-auto hidden lg:block">
      <ul className="flex items-center gap-1.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={isCurrentPath(pathname, l.href) ? 'page' : undefined}
              className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[15px] font-medium no-underline decoration-1 underline-offset-4 hover:underline aria-[current=page]:underline"
              style={{ background: UI.surface, color: UI.ink }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
