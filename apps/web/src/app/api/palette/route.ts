/**
 * GET /api/palette → { pages: [{ label, href }] } com as páginas de conteúdo elegíveis (para a paleta ⌘K).
 * Leitura de content/ acontece só no servidor; o cliente recebe uma lista curta e cacheável.
 */
import { eligiblePages } from '@/lib/content';
import { APP_ROUTES, type PalettePage } from '@/lib/terminal/palette-items';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  let pages: PalettePage[] = [];
  try {
    pages = eligiblePages()
      .map((p) => ({ label: p.frontmatter.title, href: p.frontmatter.slug }))
      .sort((a, b) => a.href.localeCompare(b.href));
  } catch (err) {
    console.error('[palette] falha ao carregar páginas:', err instanceof Error ? err.message : err);
  }
  return Response.json({ pages: [...APP_ROUTES, ...pages] }, { headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' } });
}
