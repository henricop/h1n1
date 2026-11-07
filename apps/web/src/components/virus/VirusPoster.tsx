/**
 * Pôster estático do vírion. Duas versões:
 * - `og` (public/virus/poster.svg): fundo azulado embutido; é o og:image e o fallback de carregamento antigo;
 * - `paper` (public/virus/poster-paper.svg): mesma ilustração SEM fundo, para a tela (fica sobre a cor do tema).
 * Dimensões fixas para não haver layout shift.
 */
export const POSTER_SRC = '/virus/poster.svg';
export const POSTER_PAPER_SRC = '/virus/poster-paper.svg';
export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 630;
export const POSTER_ALT = 'Ilustração do vírus influenza A(H1N1): esfera cinza-azulada com espinhos azuis (hemaglutinina) e rosa (neuraminidase) e oito segmentos de RNA no interior.';

export function VirusPoster({ className = '', decorative = false, variant = 'og' }: { className?: string; decorative?: boolean; variant?: 'og' | 'paper' }) {
  const src = variant === 'paper' ? POSTER_PAPER_SRC : POSTER_SRC;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={POSTER_WIDTH} height={POSTER_HEIGHT} alt={decorative ? '' : POSTER_ALT} aria-hidden={decorative ? 'true' : undefined} decoding="async" fetchPriority="low" className={className} />
  );
}
