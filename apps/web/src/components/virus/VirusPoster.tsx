/**
 * Pôster estático do vírion (public/virus/poster.svg): fallback sem WebGL, imagem de carregamento e og:image.
 * Dimensões fixas para não haver layout shift.
 */
export const POSTER_SRC = '/virus/poster.svg';
export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 630;
export const POSTER_ALT = 'Ilustração do vírus influenza A(H1N1): esfera cinza-azulada com espinhos azuis (hemaglutinina) e rosa (neuraminidase) e oito segmentos de RNA no interior.';

export function VirusPoster({ className = '', decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={POSTER_SRC} width={POSTER_WIDTH} height={POSTER_HEIGHT} alt={decorative ? '' : POSTER_ALT} aria-hidden={decorative ? 'true' : undefined} decoding="async" fetchPriority="low" className={className} />
  );
}
