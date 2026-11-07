/**
 * Rodapé v3 ("papel, cinema, dado"; docs/reformulacao-v4.md §1, §6 e §7). Irmão POSTERIOR do `<main>` (que é
 * opaco e fica por cima): revela-se por baixo do conteúdo com `position: sticky; bottom: 0; z-index: -1`
 * quando cabe (`data-reveal="on"`, decidido por `FooterReveal`); em `(max-width: 767px), (max-height: 640px)`,
 * reduced-motion, "Versão simples" ou sem JS, fluxo normal.
 *
 * Conteúdo: marca em condensada, descrição, aviso clínico fixo (sem lista de sintomas), seções, transparência,
 * licenças dos dados (links externos são só links, não conexões em runtime) e a nota de atualização dos números.
 */
import Link from 'next/link';
import type { NavItem } from '@/lib/content';
import { SITE } from '@/lib/site';
import { ClinicalNotice } from '@/components/shell/ClinicalNotice';
import { FooterReveal } from '@/components/shell/FooterReveal';
import { footerSections, footerTransparency, type ShellLink } from '@/components/shell/destinations';

interface FooterProps {
  nav: NavItem[];
  /** Páginas de /sobre/* e /contato/ que existem e são elegíveis. */
  institutional: ShellLink[];
}

export const FOOTER_ID = 'rodape';
export const NUMBERS_NOTE = 'Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.';

const ROW = 'grid gap-x-8 gap-y-2 border-t border-line py-5 md:grid-cols-[11rem_1fr]';
const ROW_LABEL = 'pt-2.5 font-mono text-[14px] text-muted';
const LINK_BASE = 'inline-flex min-h-[44px] items-center text-ink no-underline decoration-1 underline-offset-4 hover:underline';
const LINK = `${LINK_BASE} text-[16px]`;
const LINK_MONO = `${LINK_BASE} font-mono text-[14px]`;

function LinkRow({ label, links }: { label: string; links: readonly ShellLink[] }) {
  return (
    <nav aria-label={label} className={ROW}>
      <p className={ROW_LABEL}>{label}</p>
      <ul className="flex flex-wrap gap-x-6">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={LINK}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer({ nav, institutional }: FooterProps) {
  const sections = footerSections(nav);
  const transparency = footerTransparency(institutional);
  return (
    <footer
      id={FOOTER_ID}
      className="w-full bg-bg-soft text-ink data-[reveal=on]:sticky data-[reveal=on]:bottom-0 data-[reveal=on]:z-[-1] max-md:data-[reveal=on]:static motion-reduce:data-[reveal=on]:static [@media(max-height:640px)]:data-[reveal=on]:static"
    >
      <FooterReveal targetId={FOOTER_ID} />
      <div className="mx-auto w-full max-w-[90rem] px-[calc(env(safe-area-inset-left)+1.25rem)] pt-12 pb-[calc(env(safe-area-inset-bottom)+2rem)] md:px-10 md:pt-14">
        <div className="grid gap-6 pb-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-end md:gap-12">
          <p className="font-condensed text-[clamp(4.5rem,2.5rem+6vw,8rem)] leading-[0.82] font-extrabold tracking-[0.01em] text-ink uppercase">H1N1</p>
          <div className="space-y-4">
            <p className="max-w-[52ch] text-[17px] leading-relaxed text-muted">{SITE.description}</p>
            <ClinicalNotice className="max-w-[60ch] border-l-2 border-ink pl-4 text-[16px] leading-relaxed text-ink" />
          </div>
        </div>

        <LinkRow label="Seções" links={sections} />
        <LinkRow label="Transparência" links={transparency} />

        <div className={ROW}>
          <p className={ROW_LABEL}>Licenças dos dados</p>
          <div>
            <ul className="flex flex-wrap gap-x-6">
              {SITE.dataLicenses.map((l) => (
                <li key={l.url}>
                  <a href={l.url} rel="noopener noreferrer" target="_blank" className={LINK_MONO}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              Os microdados são de autoria dos órgãos de origem. As interpretações publicadas aqui são do projeto H1N1.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-5 font-mono text-[14px] leading-relaxed text-muted md:flex-row md:items-baseline md:justify-between md:gap-8">
          <p className="max-w-[70ch]">{NUMBERS_NOTE}</p>
          {!SITE.analyticsConsent.enabled && (
            <p data-consent-placeholder="disabled" className="shrink-0">
              Sem rastreadores nem analytics nesta versão.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
