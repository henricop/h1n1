/**
 * Aviso clínico fixo e idêntico em todo o site (docs/reformulacao-v4.md §6). Sem lista de sintomas: a lista
 * oficial vive em /sintomas/sinais-de-alerta/. Componente de servidor (sem estado); também usado no Menu.
 */
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { ALERT_HREF } from './links';

export const CLINICAL_ALERT = 'Em caso de sinais de alerta, procure um serviço de saúde.';

export function ClinicalNotice({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <p className={className} data-clinical-notice="">
      {compact ? null : <>{SITE.medicalDisclaimer} </>}
      {CLINICAL_ALERT} Veja a lista oficial em{' '}
      <Link href={ALERT_HREF} className="text-primary-700 underline decoration-1 underline-offset-2">
        {ALERT_HREF}
      </Link>
      .
    </p>
  );
}
