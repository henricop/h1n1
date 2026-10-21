import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

beforeAll(() => {
  process.env.H1N1_CONTENT_DIR = path.join(process.cwd(), 'test', 'fixtures', 'content');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('sitemap', () => {
  it('inclui só páginas elegíveis e as rotas de dados', async () => {
    const { buildSitemap } = await import('@/app/sitemap');
    const { loadAllPages } = await import('@/lib/content');
    const urls = buildSitemap(loadAllPages()).map((e) => new URL(e.url).pathname);
    expect(urls).toContain('/');
    expect(urls).toContain('/sala/');
    expect(urls).toContain('/dados/brasil/');
    expect(urls).toContain('/dados/mundo/');
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

  it('inclui /dados/fontes/[slug]/ a partir do catálogo quando a API responde', async () => {
    vi.stubEnv('H1N1_API_MOCK', '1');
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(urls).toContain('/dados/fontes/br_sivep_gripe/');
    expect(urls.filter((u) => u.startsWith('/dados/fontes/') && u !== '/dados/fontes/').length).toBe(65);
    expect(urls).not.toContain('/sintomas/');
  });

  it('omite as fontes sem quebrar quando a API está indisponível', async () => {
    vi.stubEnv('H1N1_API_MOCK', '0');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:9');
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(urls).toContain('/dados/fontes/');
    expect(urls).toContain('/o-que-e-h1n1/');
    expect(urls.some((u) => u.startsWith('/dados/fontes/') && u !== '/dados/fontes/')).toBe(false);
  });

  it('robots permite tudo e aponta para o sitemap', async () => {
    const { default: robots } = await import('@/app/robots');
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: '*', allow: '/' }]);
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
  });
});
