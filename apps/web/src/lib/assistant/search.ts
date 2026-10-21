/**
 * Busca simples nas páginas elegíveis (title, summary_answer, description). Servidor apenas (lê content/).
 */
import { eligiblePages, type ContentPage } from '@/lib/content';

export interface PageHit {
  title: string;
  url: string;
  summary_answer: string;
  description: string;
  score: number;
}

/** Palavras vazias já normalizadas (sem acento): "são" → "sao", "é" → "e". */
const STOPWORDS = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'um', 'uma', 'que', 'com', 'para', 'por', 'no', 'na', 'nos', 'nas', 'ao', 'os', 'as', 'se', 'ou', 'como', 'qual', 'quais', 'sobre', 'sao', 'tem', 'ha', 'me', 'meu', 'minha', 'eu', 'esta', 'este', 'isso']);

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function queryTerms(query: string): string[] {
  return [...new Set(normalizeText(query).split(/[^a-z0-9()]+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t)))];
}

function scorePage(p: ContentPage, terms: string[]): number {
  const title = normalizeText(p.frontmatter.title);
  const summary = normalizeText(p.frontmatter.summary_answer);
  const desc = normalizeText(p.frontmatter.description);
  const slug = normalizeText(p.frontmatter.slug);
  let score = 0;
  for (const t of terms) {
    if (title.includes(t)) score += 3;
    if (slug.includes(t)) score += 2;
    if (summary.includes(t)) score += 2;
    if (desc.includes(t)) score += 1;
  }
  return score;
}

/** Até `limit` páginas elegíveis ordenadas por relevância; vazio quando nenhum termo casa. */
export function searchPages(query: string, limit = 5, pages: ContentPage[] = eligiblePages()): PageHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  return pages
    .filter((p) => p.eligible)
    .map((p) => ({
      title: p.frontmatter.title,
      url: p.frontmatter.slug,
      summary_answer: p.frontmatter.summary_answer,
      description: p.frontmatter.description,
      score: scorePage(p, terms),
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, limit);
}
