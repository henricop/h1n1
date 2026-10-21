import Link from 'next/link';
import { SITE } from '@/lib/site';

/** Rodapé do HUD: fontes, licenças, metodologia, política editorial, aviso médico e o aviso de que não é um painel em tempo real. */
export function HudFooter({ institutional }: { institutional: Array<{ label: string; href: string }> }) {
  return (
    <section aria-label="Transparência da sala de situação" className="hud-panel hud-corner p-4 text-sm">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="hud-label">Fontes e licenças</p>
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
            <li className="text-muted">Nextstrain (Hadfield et al. 2018), dados GISAID: visualização externa.</li>
          </ul>
        </div>
        <div>
          <p className="hud-label">Método e política</p>
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
          <p className="hud-label">Leia antes de interpretar</p>
          <p className="mt-2 text-muted">Não é um painel em tempo real: cada número mostra a data da base e chega com atraso de notificação; semanas provisórias sobem em revisões.</p>
          <p className="mt-2 rounded border border-attention-700/40 bg-attention-100 px-3 py-2 text-attention-700">{SITE.medicalDisclaimer} Em caso de sinais de alerta, procure um serviço de saúde.</p>
        </div>
      </div>
    </section>
  );
}
