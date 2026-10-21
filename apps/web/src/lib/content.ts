/**
 * Conteúdo editorial: MDX em content/pages/**.mdx + content/facts.json (escritos por outro agente).
 * Este módulo valida o frontmatter (zod), deriva política de indexação e constrói navegação.
 * Nunca escreve em content/.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';

export const NAV_GROUPS = ['entenda', 'sintomas', 'vacina', 'dados', 'sobre'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/** YAML converte datas sem aspas em Date; aceitamos ambos e normalizamos para 'YYYY-MM-DD'. */
const coerceDate = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : v);
const DateYMD = z.preprocess(coerceDate, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD'));
const DateLoose = z.preprocess(coerceDate, z.string().min(4));

export const SourceRefSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  url: z.string().url(),
  accessed_at: DateLoose,
});

export const FrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).max(160, 'description deve ter no máximo 160 caracteres'),
    slug: z
      .string()
      .regex(/^\/(?:[a-z0-9-]+\/)*$/, "slug deve começar e terminar com '/', só minúsculas, dígitos e hífens, ex. '/sintomas/criancas/'"),
    intent: z.string().min(1),
    nav_group: z.enum(NAV_GROUPS).nullable(),
    clinical: z.boolean(),
    index_policy: z.enum(['index', 'noindex_until_reviewed']),
    /** 'pending_editorial_review': página não clínica aguardando checagem editorial (seção 11.1); tratada como não revisada. */
    review_status: z.enum(['draft', 'pending_editorial_review', 'pending_clinical_review', 'reviewed']),
    author: z.string().min(1),
    reviewer: z.string().nullable(),
    reviewed_at: DateYMD.nullable(),
    updated_at: DateYMD,
    sources: z.array(SourceRefSchema),
    related: z.array(z.string()),
    summary_answer: z.string().min(1),
  })
  .superRefine((fm, ctx) => {
    if (fm.review_status === 'reviewed' && (!fm.reviewer || !fm.reviewed_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "review_status 'reviewed' exige 'reviewer' e 'reviewed_at' preenchidos",
        path: ['review_status'],
      });
    }
  });

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export interface ContentPage {
  frontmatter: Frontmatter;
  body: string;
  filePath: string;
  /** Página pode ser indexada, entrar no sitemap, na navegação e na homepage. */
  eligible: boolean;
  /** robots noindex,follow */
  noindex: boolean;
  /** Mostra banner "Conteúdo em revisão clínica". */
  underReview: boolean;
}

export const FactSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  source_title: z.string().min(1),
  source_url: z.string().url(),
  quote: z.string().optional(),
  verified_by: z.string().min(1),
  verified_at: DateLoose,
});
export type Fact = z.infer<typeof FactSchema>;

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentError';
  }
}

/** Raiz de conteúdo: H1N1_CONTENT_DIR (testes) ou <cwd>/content. */
export function contentRoot(): string {
  return process.env.H1N1_CONTENT_DIR ?? path.join(process.cwd(), 'content');
}

function pagesDir(root: string): string {
  return path.join(root, 'pages');
}

function formatZodError(file: string, err: z.ZodError): string {
  const lines = err.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`);
  return `Frontmatter inválido em ${file}:\n${lines.join('\n')}`;
}

/**
 * Política derivada:
 * - index_policy 'noindex_until_reviewed' e review_status ≠ 'reviewed' → noindex, fora do sitemap/nav/home.
 * - index_policy 'index' é uma exceção explícita e justificada no frontmatter (ex.: sinais de alerta com citação
 *   literal da orientação oficial): a página é elegível e indexável mesmo sem revisão.
 * - Toda página clinical=true não revisada exibe o banner de revisão clínica, indexável ou não (seção 11.1).
 */
export function derivePolicy(fm: Frontmatter): Pick<ContentPage, 'eligible' | 'noindex' | 'underReview'> {
  const notReviewed = fm.review_status !== 'reviewed';
  const noindex = notReviewed && fm.index_policy === 'noindex_until_reviewed';
  const underReview = notReviewed && fm.clinical;
  return { eligible: !noindex, noindex, underReview };
}

export function parsePage(raw: string, filePath: string): ContentPage {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e) {
    throw new ContentError(`Não foi possível ler o frontmatter de ${filePath}: ${(e as Error).message}`);
  }
  const result = FrontmatterSchema.safeParse(parsed.data);
  if (!result.success) throw new ContentError(formatZodError(filePath, result.error));
  const frontmatter = result.data;
  return { frontmatter, body: parsed.content, filePath, ...derivePolicy(frontmatter) };
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.mdx')) out.push(full);
  }
  return out;
}

/** Slug derivado do caminho do arquivo: pages/sintomas/criancas.mdx → /sintomas/criancas/; pages/sintomas/index.mdx → /sintomas/. */
export function slugFromFile(file: string, root: string): string {
  const rel = path.relative(pagesDir(root), file).replace(/\\/g, '/').replace(/\.mdx$/, '');
  const parts = rel.split('/').filter((p) => p && p !== 'index');
  return parts.length ? `/${parts.join('/')}/` : '/';
}

export function normalizeSlug(slug: string | string[]): string {
  const s = Array.isArray(slug) ? `/${slug.join('/')}/` : slug;
  const trimmed = s.replace(/\/+$/, '').replace(/^\/+/, '');
  return trimmed ? `/${trimmed}/` : '/';
}

const cache = new Map<string, ContentPage[]>();

/** Carrega e valida todas as páginas. Lança ContentError (quebra o build) em frontmatter inválido ou slug duplicado. */
export function loadAllPages(root: string = contentRoot()): ContentPage[] {
  const cached = cache.get(root);
  if (cached && process.env.NODE_ENV === 'production') return cached;
  const pages: ContentPage[] = [];
  const seen = new Map<string, string>();
  for (const file of walk(pagesDir(root)).sort()) {
    const page = parsePage(readFileSync(file, 'utf8'), file);
    const fileSlug = slugFromFile(file, root);
    if (page.frontmatter.slug !== fileSlug) {
      throw new ContentError(`Slug '${page.frontmatter.slug}' em ${file} não corresponde ao caminho do arquivo ('${fileSlug}')`);
    }
    if (page.frontmatter.slug === '/' || page.frontmatter.slug.startsWith('/dados/brasil') || page.frontmatter.slug.startsWith('/dados/fontes')) {
      throw new ContentError(`Slug '${page.frontmatter.slug}' em ${file} é reservado a uma página de aplicação`);
    }
    const dup = seen.get(page.frontmatter.slug);
    if (dup) throw new ContentError(`Slug duplicado '${page.frontmatter.slug}' em ${file} e ${dup}`);
    seen.set(page.frontmatter.slug, file);
    pages.push(page);
  }
  validateFactReferences(pages, root);
  cache.set(root, pages);
  return pages;
}

export function getPage(slug: string | string[], root: string = contentRoot()): ContentPage | null {
  const s = normalizeSlug(slug);
  return loadAllPages(root).find((p) => p.frontmatter.slug === s) ?? null;
}

export function eligiblePages(root: string = contentRoot()): ContentPage[] {
  return loadAllPages(root).filter((p) => p.eligible);
}

// ---------- Facts ----------
export function loadFacts(root: string = contentRoot()): Map<string, Fact> {
  const file = path.join(root, 'facts.json');
  if (!existsSync(file)) return new Map();
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ContentError(`facts.json inválido: ${(e as Error).message}`);
  }
  const parsed = z.array(FactSchema).safeParse(json);
  if (!parsed.success) throw new ContentError(formatZodError(file, parsed.error));
  const map = new Map<string, Fact>();
  for (const f of parsed.data) {
    if (map.has(f.id)) throw new ContentError(`facts.json: id duplicado '${f.id}'`);
    map.set(f.id, f);
  }
  return map;
}

export function getFact(id: string, root: string = contentRoot()): Fact {
  const f = loadFacts(root).get(id);
  if (!f) throw new ContentError(`<Fato id="${id}"/> referencia um id inexistente em facts.json`);
  return f;
}

const FACT_RE = /<(?:Fato)\s+[^>]*?id\s*=\s*["']([^"']+)["']/g;
const TIMELINE_FACT_RE = /fato_id\s*[:=]\s*["']([^"']+)["']/g;

/** Build falha se algum <Fato id> ou fato_id de <LinhaDoTempo> não existir em facts.json. */
export function validateFactReferences(pages: ContentPage[], root: string = contentRoot()): void {
  const facts = loadFacts(root);
  for (const p of pages) {
    for (const re of [FACT_RE, TIMELINE_FACT_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p.body))) {
        const id = m[1]!;
        if (!facts.has(id)) throw new ContentError(`${p.filePath}: fato '${id}' não existe em facts.json`);
      }
    }
  }
}

// ---------- Navegação ----------
export interface NavItem {
  label: string;
  href: string;
  /** Subpáginas elegíveis do grupo (para rodapé/menus secundários). */
  children: Array<{ label: string; href: string }>;
}

const NAV_SPEC: ReadonlyArray<{ label: string; group: NavGroup | 'app-dados-hoje' | 'app-dados-pesquisas'; preferred: string[] }> = [
  { label: 'Sintomas e cuidados', group: 'sintomas', preferred: ['/sintomas/', '/sintomas/sinais-de-alerta/', '/sintomas/criancas/'] },
  { label: 'Vacina e prevenção', group: 'vacina', preferred: ['/vacina/', '/prevencao/'] },
  { label: 'H1N1 hoje', group: 'app-dados-hoje', preferred: ['/dados/brasil/'] },
  { label: 'Dados e pesquisas', group: 'app-dados-pesquisas', preferred: ['/dados/fontes/'] },
  { label: 'Entenda o H1N1', group: 'entenda', preferred: ['/o-que-e-h1n1/', '/transmissao/', '/historia/', '/comparar/'] },
];

function sortBySlug(a: ContentPage, b: ContentPage): number {
  const da = a.frontmatter.slug.split('/').length;
  const db = b.frontmatter.slug.split('/').length;
  return da - db || a.frontmatter.slug.localeCompare(b.frontmatter.slug);
}

/** Navegação primária (5 entradas no máximo). Entradas de conteúdo sem página elegível não aparecem. */
export function buildNavigation(pages: ContentPage[] = eligiblePages()): NavItem[] {
  const eligible = pages.filter((p) => p.eligible);
  const items: NavItem[] = [];
  for (const spec of NAV_SPEC) {
    if (spec.group === 'app-dados-hoje') {
      items.push({ label: spec.label, href: '/dados/brasil/', children: [] });
      continue;
    }
    if (spec.group === 'app-dados-pesquisas') {
      const children = [
        { label: 'Fontes oficiais', href: '/dados/fontes/' },
        { label: 'Metodologia', href: '/dados/metodologia/' },
        ...eligible.filter((p) => p.frontmatter.nav_group === 'dados').sort(sortBySlug).map((p) => ({ label: p.frontmatter.title, href: p.frontmatter.slug })),
      ];
      items.push({ label: spec.label, href: '/dados/fontes/', children });
      continue;
    }
    const groupPages = eligible.filter((p) => p.frontmatter.nav_group === spec.group).sort(sortBySlug);
    if (groupPages.length === 0) continue;
    const preferred = spec.preferred.map((s) => groupPages.find((p) => p.frontmatter.slug === s)).find(Boolean);
    const target = preferred ?? groupPages[0]!;
    items.push({
      label: spec.label,
      href: target.frontmatter.slug,
      children: groupPages.map((p) => ({ label: p.frontmatter.title, href: p.frontmatter.slug })),
    });
  }
  return items;
}

/** Primeiro slug elegível entre candidatos; null se nenhum. */
export function firstEligible(candidates: string[], pages: ContentPage[] = eligiblePages()): string | null {
  for (const c of candidates) if (pages.some((p) => p.eligible && p.frontmatter.slug === c)) return c;
  return null;
}

export function pagesInGroup(group: NavGroup, pages: ContentPage[] = eligiblePages()): ContentPage[] {
  return pages.filter((p) => p.eligible && p.frontmatter.nav_group === group).sort(sortBySlug);
}

/** Rótulo de breadcrumb para um segmento de caminho (usa título da página quando existe). */
export function breadcrumbsFor(slug: string, pages: ContentPage[] = loadAllPages()): Array<{ label: string; href: string | null }> {
  const parts = slug.split('/').filter(Boolean);
  const crumbs: Array<{ label: string; href: string | null }> = [{ label: 'Início', href: '/' }];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    const href = `${acc}/`;
    const page = pages.find((p) => p.frontmatter.slug === href);
    const isApp = href in APP_SEGMENT_LABELS && href !== '/dados/' && href !== '/sobre/';
    const label = page?.frontmatter.title ?? APP_SEGMENT_LABELS[href] ?? part.replace(/-/g, ' ');
    crumbs.push({ label, href: page || isApp ? href : null });
  }
  return crumbs;
}

export const APP_SEGMENT_LABELS: Record<string, string> = {
  '/dados/': 'Dados',
  '/dados/brasil/': 'H1N1 no Brasil',
  '/dados/fontes/': 'Fontes oficiais',
  '/dados/metodologia/': 'Metodologia',
  '/sobre/': 'Sobre',
};
