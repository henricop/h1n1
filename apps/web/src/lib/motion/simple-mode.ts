/**
 * "Versão simples (sem animação)": preferência persistida que desliga Lenis, scrub, contagem, deriva, 3D (pôster
 * por ato) e grão. Esqueleto compartilhado (núcleo): a frente A liga o controle no Menu; as demais frentes só
 * consultam `isSimpleMode()` / `onSimpleMode()`.
 *
 * Contrato: `html[data-simple="1"]` quando ativo; evento `h1n1:simple` (CustomEvent<boolean>) na mudança;
 * chave `h1n1.simple` no localStorage ("1" | "0"). `prefers-reduced-motion` NÃO liga este modo (são
 * independentes), mas quem consulta deve tratar os dois.
 */
export const SIMPLE_KEY = 'h1n1.simple';
export const SIMPLE_EVENT = 'h1n1:simple';

export function isSimpleMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.simple === '1';
}

export function readStoredSimpleMode(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SIMPLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSimpleMode(on: boolean): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (on) html.dataset.simple = '1';
  else delete html.dataset.simple;
  try {
    localStorage.setItem(SIMPLE_KEY, on ? '1' : '0');
  } catch {
    /* armazenamento indisponível: fica só na sessão */
  }
  window.dispatchEvent(new CustomEvent<boolean>(SIMPLE_EVENT, { detail: on }));
}

/** Assina mudanças; devolve a função de cancelamento. */
export function onSimpleMode(cb: (on: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const h = (e: Event) => cb(Boolean((e as CustomEvent<boolean>).detail));
  window.addEventListener(SIMPLE_EVENT, h);
  return () => window.removeEventListener(SIMPLE_EVENT, h);
}

/**
 * Script inline e síncrono (no `<head>` do layout) que aplica `data-simple="1"` a partir do localStorage antes da
 * primeira pintura, evitando o "flash" de movimento. Cabe no CSP (`script-src 'self' 'unsafe-inline'`); não faz rede.
 */
export const SIMPLE_MODE_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(SIMPLE_KEY)})==='1')document.documentElement.setAttribute('data-simple','1')}catch(e){}`;
