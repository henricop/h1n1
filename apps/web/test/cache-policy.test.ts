import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { API_REVALIDATE_SECONDS } from '@/lib/api';

const APP = path.join(process.cwd(), 'src', 'app');
const read = (p: string) => readFileSync(path.join(APP, p), 'utf8');

/**
 * Política de cache: páginas de dados usam ISR com o mesmo valor de API_REVALIDATE_SECONDS. O Next exige literal
 * em `export const revalidate`, então este teste garante que o literal não diverge da constante da lib.
 * Páginas que leem searchParams permanecem `force-dynamic` (documentado no próprio arquivo).
 */
describe('política de cache', () => {
  it('páginas ISR exportam revalidate igual a API_REVALIDATE_SECONDS', () => {
    for (const f of ['page.tsx', 'dados/fontes/[idOrSlug]/page.tsx', 'dados/metodologia/page.tsx', '[...slug]/page.tsx', 'sitemap.ts']) {
      const src = read(f);
      const m = /export const revalidate = (\d+);/.exec(src);
      expect(m, `${f} deve exportar revalidate literal`).not.toBeNull();
      expect(Number(m![1]), `${f}: revalidate ≠ API_REVALIDATE_SECONDS`).toBe(API_REVALIDATE_SECONDS);
      expect(src).not.toContain("force-dynamic");
    }
  });

  it('páginas com searchParams são force-dynamic e documentam o motivo', () => {
    for (const f of ['dados/brasil/page.tsx', 'dados/fontes/page.tsx']) {
      const src = read(f);
      expect(src).toContain("export const dynamic = 'force-dynamic'");
      expect(src).toMatch(/searchParams/);
      expect(src).toMatch(/Dinâmica por exigência dos searchParams/);
    }
  });

  it('global-error.tsx existe, é client e renderiza html/body', () => {
    const src = read('global-error.tsx');
    expect(src.startsWith("'use client'")).toBe(true);
    expect(src).toContain('<html lang="pt-BR">');
    expect(src).toContain('<body');
  });
});
