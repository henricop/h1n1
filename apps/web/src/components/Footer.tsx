import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { SITE } from '@/lib/site';

interface FooterProps {
  nav: NavItem[];
  /** Slugs de /sobre/* e /contato/ que existem e são elegíveis. */
  institutional: Array<{ label: string; href: string }>;
}

export function Footer({ nav, institutional }: FooterProps) {
  return (
    <footer className="mt-16 border-t border-line bg-paper text-sm">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-semibold text-navy-900">H1N1</p>
          <p className="mt-2 text-muted">{SITE.description}</p>
          <p className="mt-4 rounded border border-attention-700/30 bg-attention-100 p-3 text-attention-700">
            {SITE.medicalDisclaimer} Em caso de sinais de alerta, procure um serviço de saúde.
          </p>
        </div>
        <nav aria-label="Seções do site">
          <p className="font-semibold text-navy-900">Seções</p>
          <ul className="mt-2 space-y-1">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="touch inline-flex items-center py-1">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <p className="font-semibold text-navy-900">Transparência</p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/dados/fontes/" className="touch inline-flex items-center py-1">
                Fontes oficiais
              </Link>
            </li>
            <li>
              <Link href="/dados/metodologia/" className="touch inline-flex items-center py-1">
                Metodologia
              </Link>
            </li>
            {institutional.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="touch inline-flex items-center py-1">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="font-semibold text-navy-900">Licenças dos dados</p>
          <ul className="mt-2 space-y-1 text-muted">
            {SITE.dataLicenses.map((l) => (
              <li key={l.url}>
                <a href={l.url} rel="noopener noreferrer" target="_blank">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-muted">
            Os microdados são de autoria dos órgãos de origem. As interpretações publicadas aqui são do projeto H1N1.
          </p>
          {!SITE.analyticsConsent.enabled && (
            <p className="mt-4 text-xs text-muted" data-consent-placeholder="disabled">
              Este site não usa rastreadores nem analytics nesta versão.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
