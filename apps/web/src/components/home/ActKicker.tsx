import { actAccessibleName } from '@/lib/virus/chapters';

/**
 * Kicker de ato "( 06 ) No Brasil": parênteses e numeral `aria-hidden`; nome acessível "Ato 6 de 7: No Brasil"
 * (contrato v4 §6, kickers sem número).
 */
export function ActKicker({ index, kicker, className = '' }: { index: string; kicker: string; className?: string }) {
  return (
    <p className={`kicker-mono ${className}`}>
      <span aria-hidden="true">( {index} ) </span>
      <span className="sr-only">{actAccessibleName(index, kicker)}</span>
      <span aria-hidden="true">{kicker}</span>
    </p>
  );
}
