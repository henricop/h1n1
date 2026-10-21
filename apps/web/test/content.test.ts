import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ContentError,
  FrontmatterSchema,
  buildNavigation,
  derivePolicy,
  eligiblePages,
  firstEligible,
  getPage,
  loadAllPages,
  parsePage,
} from '@/lib/content';

const FIXTURES = path.join(process.cwd(), 'test', 'fixtures', 'content');

const VALID = {
  title: 'T',
  description: 'D',
  slug: '/x/',
  intent: 'i',
  nav_group: 'entenda',
  clinical: false,
  index_policy: 'index',
  review_status: 'draft',
  author: 'A',
  reviewer: null,
  reviewed_at: null,
  updated_at: '2026-10-20',
  sources: [],
  related: [],
  summary_answer: 'S',
};

function mdx(fm: Record<string, unknown>, body = 'corpo'): string {
  const yaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v === null ? 'null' : Array.isArray(v) ? '[]' : typeof v === 'string' ? JSON.stringify(v) : String(v)}`)
    .join('\n');
  return `---\n${yaml}\n---\n\n${body}\n`;
}

beforeAll(() => {
  process.env.H1N1_CONTENT_DIR = FIXTURES;
});

describe('frontmatter', () => {
  it('aceita frontmatter válido', () => {
    expect(FrontmatterSchema.safeParse(VALID).success).toBe(true);
  });

  it('falha em frontmatter inválido (description > 160, slug sem barra, nav_group desconhecido)', () => {
    expect(() => parsePage(mdx({ ...VALID, description: 'x'.repeat(161) }), 'a.mdx')).toThrow(ContentError);
    expect(() => parsePage(mdx({ ...VALID, slug: 'sem-barra' }), 'a.mdx')).toThrow(/slug/);
    expect(() => parsePage(mdx({ ...VALID, nav_group: 'blog' }), 'a.mdx')).toThrow(ContentError);
    expect(() => parsePage(mdx({ ...VALID, updated_at: '20/10/2026' }), 'a.mdx')).toThrow(/YYYY-MM-DD/);
  });

  it("rejeita review_status 'reviewed' sem reviewer/reviewed_at com mensagem clara", () => {
    expect(() => parsePage(mdx({ ...VALID, review_status: 'reviewed' }), 'rev.mdx')).toThrow(/exige 'reviewer' e 'reviewed_at'/);
    expect(() => parsePage(mdx({ ...VALID, review_status: 'reviewed', reviewer: 'Dra. X' }), 'rev.mdx')).toThrow(ContentError);
    const ok = parsePage(mdx({ ...VALID, review_status: 'reviewed', reviewer: 'Dra. X', reviewed_at: '2026-10-19' }), 'rev.mdx');
    expect(ok.frontmatter.review_status).toBe('reviewed');
  });
});

describe('política derivada', () => {
  it('noindex_until_reviewed + não revisado → noindex, inelegível, banner', () => {
    const p = derivePolicy(FrontmatterSchema.parse({ ...VALID, clinical: true, index_policy: 'noindex_until_reviewed', review_status: 'pending_clinical_review' }));
    expect(p).toEqual({ eligible: false, noindex: true, underReview: true });
  });
  it('noindex_until_reviewed + reviewed → indexável', () => {
    const p = derivePolicy(FrontmatterSchema.parse({ ...VALID, index_policy: 'noindex_until_reviewed', review_status: 'reviewed', reviewer: 'R', reviewed_at: '2026-10-19' }));
    expect(p).toEqual({ eligible: true, noindex: false, underReview: false });
  });
  it("'pending_editorial_review' é aceito e tratado como não revisado", () => {
    const fm = FrontmatterSchema.parse({ ...VALID, review_status: 'pending_editorial_review' });
    expect(derivePolicy(fm)).toEqual({ eligible: true, noindex: false, underReview: false });
    expect(derivePolicy({ ...fm, clinical: true, index_policy: 'noindex_until_reviewed' }).noindex).toBe(true);
  });
  it('index explícito: página clínica não revisada fica indexável e elegível, mas com banner de revisão', () => {
    expect(derivePolicy(FrontmatterSchema.parse(VALID)).noindex).toBe(false);
    const p = derivePolicy(FrontmatterSchema.parse({ ...VALID, clinical: true, index_policy: 'index' }));
    expect(p).toEqual({ eligible: true, noindex: false, underReview: true });
  });
});

describe('carregamento das fixtures', () => {
  it('carrega todas as páginas e resolve slugs', () => {
    const all = loadAllPages();
    expect(all.length).toBe(7);
    expect(getPage(['sintomas', 'sinais-de-alerta'])?.frontmatter.title).toMatch(/Sinais de alerta/);
    expect(getPage('/vacina/')?.eligible).toBe(false);
    expect(getPage('/nao-existe/')).toBeNull();
  });

  it('navegação exclui grupos sem página elegível e aponta para a melhor página elegível', () => {
    const nav = buildNavigation(eligiblePages());
    const labels = nav.map((n) => n.label);
    expect(labels).toEqual(['Sintomas e cuidados', 'H1N1 hoje', 'Dados e pesquisas', 'Entenda o H1N1']);
    expect(labels).not.toContain('Vacina e prevenção');
    expect(nav.find((n) => n.label === 'Sintomas e cuidados')?.href).toBe('/sintomas/sinais-de-alerta/');
    expect(nav.find((n) => n.label === 'Entenda o H1N1')?.href).toBe('/o-que-e-h1n1/');
    expect(nav.find((n) => n.label === 'H1N1 hoje')?.href).toBe('/dados/brasil/');
    const dados = nav.find((n) => n.label === 'Dados e pesquisas');
    expect(dados?.children.map((c) => c.href)).toContain('/dados/metodologia/');
  });

  it('firstEligible pula páginas em revisão', () => {
    expect(firstEligible(['/sintomas/', '/sintomas/sinais-de-alerta/'])).toBe('/sintomas/sinais-de-alerta/');
    expect(firstEligible(['/vacina/'])).toBeNull();
  });
});

describe('metadados de página clínica do fixture', () => {
  it('/sintomas/ (clínica, em revisão) sai com robots noindex,follow; /sintomas/sinais-de-alerta/ (revisada) é indexável', async () => {
    const { pageMetadata } = await import('@/lib/metadata');
    const sintomas = getPage('/sintomas/');
    expect(sintomas?.frontmatter.clinical).toBe(true);
    expect(sintomas?.noindex).toBe(true);
    const md = pageMetadata(sintomas!);
    expect(md.robots).toEqual({ index: false, follow: true });
    expect(md.alternates?.canonical).toBe('/sintomas/');
    expect(md.title).toBe('Sintomas de H1N1');

    const alerta = pageMetadata(getPage('/sintomas/sinais-de-alerta/')!);
    expect(alerta.robots).toMatchObject({ index: true, follow: true });
    expect(alerta.openGraph).toMatchObject({ type: 'article', locale: 'pt_BR', url: '/sintomas/sinais-de-alerta/' });
  });
});

describe('facts', () => {
  it('build falha quando <Fato id> não existe em facts.json', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'h1n1-content-'));
    mkdirSync(path.join(dir, 'pages'));
    writeFileSync(path.join(dir, 'facts.json'), '[]');
    writeFileSync(path.join(dir, 'pages', 'x.mdx'), mdx(VALID, '<Fato id="inexistente" />'));
    expect(() => loadAllPages(dir)).toThrow(/fato 'inexistente' não existe/);
  });

  it('build falha quando o slug do frontmatter não bate com o caminho do arquivo', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'h1n1-content-'));
    mkdirSync(path.join(dir, 'pages'));
    writeFileSync(path.join(dir, 'pages', 'y.mdx'), mdx({ ...VALID, slug: '/x/' }));
    expect(() => loadAllPages(dir)).toThrow(/não corresponde ao caminho/);
  });
});
