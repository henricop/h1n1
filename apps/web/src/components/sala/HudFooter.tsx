import Link from 'next/link';
import { SITE } from '@/lib/site';

/** Rodapé da sala de dados: fontes, licenças, metodologia, política editorial, aviso médico e o aviso de que não é um painel em tempo real. */
export function HudFooter({ institutional }: { institutional: Array<{ label: string; href: string }> }) {
  return (
    <section aria-label="Transparência da sala de dados" className="card-soft p-6 text-[15px]">
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <p className="label">Fontes e licenças</p>
          <ul className="mt-2 space-y-1">
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
          <p className="label">Método e política</p>
          <ul className="mt-2 space-y-1">
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
          <p className="label">Leia antes de interpretar</p>
          <p className="mt-2 text-muted">Não é um painel em tempo real: cada número mostra a data da base e chega com atraso de notificação; semanas provisórias sobem em revisões.</p>
          <p className="mt-2 rounded-2xl border border-attention-700/20 bg-attention-100 px-4 py-3 text-attention-700">{SITE.medicalDisclaimer} Em caso de sinais de alerta, procure um serviço de saúde.</p>
        </div>
      </div>
    </section>
  );
}
