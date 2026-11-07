import Link from 'next/link';
import { SITE } from '@/lib/site';
import { LABEL } from '@/components/charts/ui';

interface Props {
  institutional: Array<{ label: string; href: string }>;
  /** Página de sinais de alerta (se elegível). */
  alertHref?: string | null;
}

/** Transparência da Sala de dados: fontes, licenças, metodologia, política editorial, aviso sobre atraso e aviso clínico. */
export function DataFooter({ institutional, alertHref = null }: Props) {
  return (
    <section aria-label="Transparência da sala de dados" className="border-t border-ink pt-8">
      <div className="grid gap-10 md:grid-cols-3">
        <div>
          <p className={LABEL}>Fontes e licenças</p>
          <ul className="mt-3 space-y-2">
            {SITE.dataLicenses.map((l) => (
              <li key={l.url}>
                <a href={l.url} rel="noopener noreferrer" target="_blank">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/dados/fontes/">Catálogo de fontes oficiais</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className={LABEL}>Método e política</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/dados/metodologia/">Metodologia e regras de integridade</Link>
            </li>
            {institutional.map((i) => (
              <li key={i.href}>
                <Link href={i.href}>{i.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={LABEL}>Leia antes de interpretar</p>
          <p className="mt-3 text-muted">Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base. Semanas provisórias sobem em revisões.</p>
          <p className="mt-3 rounded-2xl border border-attention-700/30 bg-attention-100 px-4 py-3 text-attention-700">
            {SITE.medicalDisclaimer} Em caso de sinais de alerta, procure um serviço de saúde.
            {alertHref && (
              <>
                {' '}
                Veja a <Link href={alertHref}>lista oficial de sinais de alerta</Link>.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
