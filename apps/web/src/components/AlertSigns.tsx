import Link from 'next/link';

/**
 * Frase fixa de segurança, IDÊNTICA em todo o site (a lista de sinais de alerta só existe em
 * /sintomas/sinais-de-alerta/). Módulo sem dependências do resto do site para poder ser usado também em
 * componentes de cliente (error.tsx).
 */
export const ALERT_SIGNS_PATH = '/sintomas/sinais-de-alerta/';
export const ALERT_SIGNS_TEXT = `Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em ${ALERT_SIGNS_PATH}.`;

/** A frase fixa, com o caminho como link. O texto corrido é exatamente `ALERT_SIGNS_TEXT`. */
export function AlertSigns() {
  return (
    <>
      Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em <Link href={ALERT_SIGNS_PATH}>{ALERT_SIGNS_PATH}</Link>.
    </>
  );
}
