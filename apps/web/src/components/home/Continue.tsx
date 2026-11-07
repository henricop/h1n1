import Link from 'next/link';
import { ClinicalNotice } from '@/components/Notices';
import { eligiblePages, firstEligible, type ContentPage } from '@/lib/content';
import { ACT_CONTINUE, CLINICAL_ALERT_NOTE, HOME_INDEX } from '@/lib/virus/copy';
import { ActKicker } from './ActKicker';
import { actId } from './acts';

/**
 * Ato 7 · Continue daqui: índice editorial em tipografia gigante, em ordem de necessidade (itens somem quando a
 * página não é elegível), e o aviso clínico FIXO (contrato v4 §6). Sem lista de sintomas na home.
 */
export function Continue({ pages = eligiblePages() }: { pages?: ContentPage[] }) {
  const items = HOME_INDEX.map((i) => ({ ...i, href: i.href ?? firstEligible(i.candidates, pages) })).filter((i): i is typeof i & { href: string } => typeof i.href === 'string');
  const alerta = firstEligible([CLINICAL_ALERT_NOTE.path], pages);
  const id = actId(ACT_CONTINUE.index);
  return (
    <section id={id} data-act={ACT_CONTINUE.index} data-theme="paper" aria-labelledby={`${id}-titulo`} className="relative z-10 bg-bg px-5 py-24 md:px-10 lg:pl-[12.5rem] lg:pr-16">
      <ActKicker index={ACT_CONTINUE.index} kicker={ACT_CONTINUE.kicker} />
      <h2 id={`${id}-titulo`} className="display-lg mt-4">
        {ACT_CONTINUE.title}
      </h2>
      <ol className="mt-12 max-w-[64rem] divide-y divide-line border-t border-line">
        {items.map((it, n) => (
          <li key={it.href}>
            <Link href={it.href} className="group flex flex-wrap items-baseline gap-x-6 gap-y-1 py-5 no-underline md:flex-nowrap">
              <span className="kicker-mono w-8 shrink-0" aria-hidden="true">
                {String(n + 1).padStart(2, '0')}
              </span>
              <span className="display-md transition-colors group-hover:text-primary-600">{it.label}</span>
              <span className="ml-auto hidden max-w-[24rem] text-right text-[15px] text-muted md:inline">{it.text}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-16 max-w-[44rem] space-y-3" aria-label="Aviso">
        <ClinicalNotice />
        <p className="text-[15px] leading-relaxed text-ink">
          {CLINICAL_ALERT_NOTE.before}
          {alerta ? <Link href={alerta}>{CLINICAL_ALERT_NOTE.path}</Link> : CLINICAL_ALERT_NOTE.path}
          {CLINICAL_ALERT_NOTE.after}
        </p>
      </div>
    </section>
  );
}
