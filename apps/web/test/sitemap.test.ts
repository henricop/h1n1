import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';

beforeAll(() => {
  process.env.H1N1_CONTENT_DIR = path.join(process.cwd(), 'test', 'fixtures', 'content');
});

describe('sitemap', () => {
  it('inclui só páginas elegíveis e as rotas de dados', async () => {
    const { buildSitemap } = await import('@/app/sitemap');
    const { loadAllPages } = await import('@/lib/content');
    const urls = buildSitemap(loadAllPages()).map((e) => new URL(e.url).pathname);
    expect(urls).toContain('/');
    expect(urls).toContain('/dados/brasil/');
    expect(urls).toContain('/dados/fontes/');
    expect(urls).toContain('/dados/metodologia/');
    expect(urls).toContain('/o-que-e-h1n1/');
    expect(urls).toContain('/sintomas/sinais-de-alerta/');
    expect(urls).toContain('/sobre/equipe-e-revisao/');
    expect(urls).not.toContain('/sintomas/');
    expect(urls).not.toContain('/vacina/');
    // sem duplicata de /dados/metodologia/ (MDX + rota de aplicação)
    expect(urls.filter((u) => u === '/dados/metodologia/').length).toBe(1);
  });

  it('robots permite tudo e aponta para o sitemap', async () => {
    const { default: robots } = await import('@/app/robots');
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: '*', allow: '/' }]);
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
  });
});
