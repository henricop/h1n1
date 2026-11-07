import type { Metadata } from 'next';
import Link from 'next/link';
import { firstEligible } from '@/lib/content';
import { AlertSigns, ALERT_SIGNS_PATH } from '@/components/AlertSigns';
import { FRAME, FRAME_TOP, KICKER } from '@/components/mdx/frame';

export const metadata: Metadata = { title: 'Página não encontrada', robots: { index: false, follow: false } };

/** "Sinais de alerta" só aparece se a página existir e for elegível (indexável/publicada). */
function alertLinkAvailable(): boolean {
  try {
    return firstEligible([ALERT_SIGNS_PATH]) !== null;
  } catch {
    return false;
  }
}

export default function NotFound() {
  const links = [
    ...(alertLinkAvailable() ? [{ href: ALERT_SIGNS_PATH, label: 'Sinais de alerta' }] : []),
    { href: '/', label: 'Início' },
    { href: '/dados/brasil/', label: 'Dados do Brasil' },
    { href: '/dados/fontes/', label: 'Fontes e metodologia' },
  ];
  return (
    <section className={`${FRAME} ${FRAME_TOP} pb-24 md:pb-32`}>
      <p className={`${KICKER} mt-8 md:mt-12`}>
        <span aria-hidden="true">[ </span>erro 404<span aria-hidden="true"> ]</span>
      </p>
      <h1 className="display-xl mt-6 text-balance">Página não encontrada.</h1>
      <p className="lead mt-10 max-w-2xl md:mt-14">O endereço pode ter mudado ou o conteúdo ainda não foi publicado.</p>
      <nav aria-label="Links úteis" className="mt-14 max-w-3xl md:mt-20">
        <ul className="border-t border-ink">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="group flex min-h-16 items-baseline justify-between gap-6 border-b border-line py-5 text-ink no-underline">
                <span className="display-md group-hover:underline group-focus-visible:underline">{l.label}</span>
                <span aria-hidden="true" className="font-mono text-[14px] text-muted">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-10 max-w-2xl text-[17px] text-muted">
        Prefere procurar? Use o botão <strong className="font-semibold text-ink">Menu</strong>, no canto superior direito, para ir a qualquer seção.
      </p>
      <p className="mt-6 max-w-2xl border-l-2 border-ink pl-4 text-[15px] leading-snug text-ink md:text-base">
        <AlertSigns />
      </p>
    </section>
  );
}
