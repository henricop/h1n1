/**
 * Classes compartilhadas dos blocos de dado (piso de 14 px).
 * `.label`, `.meta`, `.kicker-mono`, `.console` e `.data-table th/caption` vêm de globals.css FORA de @layer
 * (por isso vencem utilitários) com 12–13 px; o sufixo `!` (important) garante 14 px sem editar o CSS do núcleo.
 */
/** Rótulo mono de painel/campo (caixa normal). */
export const LABEL = 'font-mono text-[14px] font-medium leading-snug text-muted';
/** Rodapé de metadados do painel: fonte · licença · base de. */
export const META = 'meta mt-4 text-[14px]!';
/** Tabela de dados: cabeçalho e legenda em 14 px. */
export const TABLE = 'data-table [&_caption]:text-[14px]! [&_th]:text-[14px]!';
/** Texto de apoio (notas, legendas de gráfico): sans 14 px. */
export const NOTE = 'text-[14px] leading-relaxed text-muted';
/** Resumo de <details> (Ver como tabela). */
export const SUMMARY = 'touch inline-flex cursor-pointer items-center rounded-full border border-line-strong bg-card px-4 text-[14px] font-medium text-primary-700 hover:border-primary-600';
