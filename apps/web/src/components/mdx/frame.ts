/**
 * Contêineres das páginas editoriais. O `main` do shell é largura total (sem `max-w` nem padding): cada página
 * define o próprio contêiner e reserva o espaço superior da marca e da pílula "Menu" (fixas): 5 rem no celular,
 * 6 rem a partir de `md`.
 */
export const FRAME = 'mx-auto w-full max-w-6xl px-5 md:px-8';
export const FRAME_TOP = 'pt-20 md:pt-24';
/** Coluna principal + coluna do sumário (a partir de `lg`). */
export const ARTICLE_GRID = 'lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-20';
/** Título de seção em serifa (≥ 30 px), igual ao `h2` do `.prose`. */
export const SECTION_TITLE = 'font-display text-3xl leading-[1.05] tracking-[-0.01em] text-ink md:text-4xl';
/** Etiqueta mono entre colchetes (14 px). */
export const KICKER = 'font-mono text-[14px] font-medium leading-none text-muted';
