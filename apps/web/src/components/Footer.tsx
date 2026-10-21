import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { SITE } from '@/lib/site';
import { resolvePrimaryNav } from './Header';

interface FooterProps {
  nav: NavItem[];
  /** Slugs de /sobre/* e /contato/ que existem e são elegíveis. */
  institutional: Array<{ label: string; href: string }>;
}

export function Footer({ nav, institutional }: FooterProps) {
  const primary = resolvePrimaryNav(nav);
  const extra = nav.filter((n) => !primary.some((p) => p.href === n.href) && !['Entenda o H1N1', 'H1N1 hoje', 'Dados e pesquisas', 'Sintomas e cuidados', 'Vacina e prevenção'].includes(n.label));
  return (
    <footer className="mt-20 border-t border-line bg-bg-soft text-[15px]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 md:px-6 lg:grid-cols-4">
        <div>
          <p className="font-display text-xl font-extrabold tracking-[-0.02em] text-primary-600">H1N1</p>
          <p className="mt-2 text-muted">{SITE.description}</p>
          <p className="mt-4 rounded-2xl border border-attention-700/20 bg-attention-100 p-4 text-attention-700">
            {SITE.medicalDisclaimer} Em caso de sinais de alerta, procure um serviço de saúde.
          </p>
          <p className="mt-3 text-[13px] text-faint">Não é um painel em tempo real: todo número traz a data da base.</p>
        </div>
        <nav aria-label="Seções do site">
          <p className="label">Seções</p>
          <ul className="mt-2 space-y-1">
            {primary.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="touch inline-flex items-center py-1">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/dados/mundo/" className="touch inline-flex items-center py-1">
                H1N1 no mundo
              </Link>
            </li>
            {extra.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="touch inline-flex items-center py-1">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <p className="label">Transparência</p>
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
          <p className="label">Licenças dos dados</p>
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
            <p className="mt-4 text-[13px] text-faint" data-consent-placeholder="disabled">
              Este site não usa rastreadores nem analytics nesta versão.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
