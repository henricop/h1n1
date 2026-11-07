/**
 * Heurística simples de idioma para citações e títulos de fontes (WCAG 3.1.2: trechos em outro idioma levam `lang`).
 * Não há campo `quote_lang` em facts.json: se algum dia existir, o componente deve preferi-lo a esta detecção.
 *
 * Regra: acento típico do português → pt. Sem acento, vence o idioma com mais palavras funcionais (as palavras
 * ambíguas entre os dois idiomas, como "a", "e", "as" e "no", ficam de fora das duas listas).
 */
const EN_WORDS = /\b(the|of|and|is|in|to|that|for|with|are|was|were|has|have|by|on|from|this|these|which|it|an|be|can|may|not|or|at|their|than|more|we|our|its|also|per|plus)\b/gi;
const PT_WORDS = /\b(de|que|do|da|dos|das|para|com|em|os|um|uma|na|nos|nas|por|se|ao|não|são|mais|pelo|pela|ou|como|entre|sobre|também)\b/gi;
const PT_ACCENT = /[ãõçáéíóúâêô]/i;

export type Lang = 'pt-BR' | 'en';

export function detectLang(text: string): Lang {
  if (PT_ACCENT.test(text)) return 'pt-BR';
  const en = (text.match(EN_WORDS) ?? []).length;
  const pt = (text.match(PT_WORDS) ?? []).length;
  return en > pt && en >= 1 ? 'en' : 'pt-BR';
}

/** Citação/título claramente em inglês? (limiar mais alto para títulos, que misturam nomes próprios e siglas). */
export function isEnglish(text: string, minHits = 1): boolean {
  if (PT_ACCENT.test(text)) return false;
  const en = (text.match(EN_WORDS) ?? []).length;
  const pt = (text.match(PT_WORDS) ?? []).length;
  return en > pt && en >= minHits;
}

/** "OMS — Disease Outbreak News, ..." → { org: 'OMS', title: 'Disease Outbreak News, ...' } (o separador é " — "). */
export function splitSourceTitle(full: string): { org: string | null; title: string } {
  const i = full.indexOf(' — ');
  if (i < 0) return { org: null, title: full };
  return { org: full.slice(0, i), title: full.slice(i + 3) };
}
