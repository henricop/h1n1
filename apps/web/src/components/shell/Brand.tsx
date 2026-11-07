/**
 * Marca do shell: "H1N1" em condensada (Big Shoulders 800) + descritor a partir de `md`. Pílula de papel claro
 * opaco em qualquer tema (`.pill`); o posicionamento fixo (canto superior esquerdo, safe areas) vem do cabeçalho
 * do layout.
 */
import Link from 'next/link';
import { UI } from './paper';

export const BRAND_DESCRIPTOR = 'informação clara, dados oficiais';

export function Brand({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`H1N1, ${BRAND_DESCRIPTOR}: página inicial`}
      className={`pill pointer-events-auto gap-3 ${className}`}
      style={{ minHeight: '3rem' }}
    >
      <span className="font-condensed text-[28px] leading-none font-extrabold tracking-[0.02em] uppercase">H1N1</span>
      <span className="hidden text-[15px] font-normal md:inline" style={{ color: UI.muted }}>
        {BRAND_DESCRIPTOR}
      </span>
    </Link>
  );
}
