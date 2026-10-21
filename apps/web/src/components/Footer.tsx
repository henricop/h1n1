import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { SITE } from '@/lib/site';
import { PRIMARY_NAV } from './Header';

interface FooterProps {
  nav: NavItem[];
  /** Slugs de /sobre/* e /contato/ que existem e são elegíveis. */
  institutional: Array<{ label: string; href: string }>;
}

export function Footer({ nav, institutional }: FooterProps) {
  return (
    <footer className="mt-16 border-t border-line bg-bg-900 text-sm">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-base font-semibold text-ink">H1N1 · Sala de Situação</p>
          <p className="mt-2 text-muted">{SITE.description}</p>
          <p className="mt-4 rounded border border-attention-700/40 bg-attention-100 p-3 text-attention-700">
            {SITE.medicalDisclaimer} Em caso de sinais de alerta, procure um serviço de saúde.
          </p>
          <p className="mt-3 font-mono text-[11px] text-faint">Não é um painel em tempo real: todo número traz a data da base.</p>
        </div>
        <nav aria-label="Seções do site">
          <p className="hud-label">Seções</p>
          <ul className="mt-2 space-y-1">
            {PRIMARY_NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="touch inline-flex items-center py-1">
                  {n.label}
                </Link>
              </li>
            ))}
            {nav
              .filter((n) => !PRIMARY_NAV.some((p) => p.href === n.href))
              .map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="touch inline-flex items-center py-1">
                    {n.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <p className="hud-label">Transparência</p>
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
          <p className="hud-label">Licenças dos dados</p>
          <ul className="mt-2 space-y-1 text-muted">
            {SITE.dataLicenses.map((l) => (
              <li key={l.url}>
                <a href={l.url} rel="noopener noreferrer" target="_blank">
                  {l.label}
                </a>
              </li>
            ))}
            <li>Nextstrain (Hadfield et al. 2018), dados GISAID: visualização externa, não redistribuída.</li>
          </ul>
          <p className="mt-4 text-muted">Os microdados são de autoria dos órgãos de origem. As interpretações publicadas aqui são do projeto H1N1.</p>
          {!SITE.analyticsConsent.enabled && (
            <p className="mt-4 text-xs text-faint" data-consent-placeholder="disabled">
              Este site não usa rastreadores nem analytics nesta versão.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
