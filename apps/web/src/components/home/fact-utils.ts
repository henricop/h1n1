/**
 * Funções puras dos fatos na home (sem React, sem fs; testadas em test/home.test.tsx):
 * - `extractBigNumber`: o valor do número gigante vem do texto do fato (nunca é digitado no componente);
 * - `shortSource`: autor/órgão + ano a partir do `source_title` ("Dou D. et al. (2018)", "Ministério da Saúde");
 * - `quoteLang`: 'en' quando a citação está em inglês (recebe `lang="en"`), senão 'pt'.
 */

export type BigKind = 'nm' | 'h';

export interface BigNumber {
  value: number;
  /** o texto qualifica o valor ("cerca de", "aproximadamente", "~") */
  approx: boolean;
  /** unidade curta exibida ao lado do número */
  unit: string;
  /** trecho do texto de onde o número saiu (para o teste e para a legenda) */
  raw: string;
}

const PATTERNS: Record<BigKind, { re: RegExp; unit: string }> = {
  nm: { re: /(cerca de|aproximadamente|~)?\s*(\d+(?:[.,]\d+)?)\s*(nan[oô]metros?|nm)\b/i, unit: 'nm' },
  h: { re: /(cerca de|aproximadamente|~)?\s*(\d+(?:[.,]\d+)?)\s*(horas?|h)\b/i, unit: 'h' },
};

/** Primeiro número com a unidade pedida dentro do texto; null se o texto não o contém. */
export function extractBigNumber(text: string, kind: BigKind): BigNumber | null {
  const { re, unit } = PATTERNS[kind];
  const m = re.exec(text);
  if (!m) return null;
  const value = Number(m[2]!.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return { value, approx: Boolean(m[1]), unit, raw: m[0].trim() };
}

/** "Dou D. et al. — Influenza A Virus… (2018); texto integral…" → "Dou D. et al. (2018)". */
export function shortSource(sourceTitle: string): string {
  const head = sourceTitle.split(/\s[—–-]\s/)[0]!.trim();
  const year = /\b((?:19|20)\d{2})\b/.exec(sourceTitle)?.[1];
  const hasYear = year !== undefined && head.includes(year);
  return year && !hasYear ? `${head} (${year})` : head;
}

const EN_WORDS = /\b(the|and|of|with|from|are|is|can|that|which|or|in|to|by|for|virus|viruses|cells?|infection|influenza)\b/gi;
const PT_MARKS = /[ãõçáéíóúâêôà]|\b(e|de|do|da|dos|das|que|não|com|para|é|são|os|as|um|uma)\b/i;

/** Heurística de idioma da citação: inglês quando há várias palavras funcionais inglesas e nenhum sinal de português. */
export function quoteLang(quote: string | undefined): 'en' | 'pt' {
  if (!quote) return 'pt';
  const en = (quote.match(EN_WORDS) ?? []).length;
  if (en >= 2 && !PT_MARKS.test(quote)) return 'en';
  return en >= 4 && !/[ãõçáéíóúâêôà]/.test(quote) ? 'en' : 'pt';
}

/** Primeiras palavras do claim, para o `aria-label` único do link "fonte". */
export function claimExcerpt(claim: string, words = 8): string {
  const parts = claim.trim().split(/\s+/);
  const head = parts.slice(0, words).join(' ');
  return parts.length > words ? `${head}…` : head;
}
