import { slugify } from '@/lib/format';
import { LIMITES_ID, LIMITES_TITULO } from './Limites';

/** Título de seção (`##`) do corpo MDX, na ordem do documento. Alimenta o sumário lateral. */
export interface ArticleHeading {
  id: string;
  text: string;
}

/** ids que o próprio template usa (seções de fontes, autoria e relacionados) e o <Limites>. */
const RESERVED_IDS = ['h-fontes', 'h-autoria', 'h-rel', LIMITES_ID];

interface Node {
  type: string;
  tagName?: string;
  name?: string;
  value?: string;
  properties?: Record<string, unknown>;
  attributes?: Array<{ type: string; name?: string; value?: unknown }>;
  children?: Node[];
}

function textOf(node: Node): string {
  if (node.type === 'text' && typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

function walk(node: Node, visit: (n: Node) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/**
 * Plugin rehype: dá `id` a cada `h2` do MDX (slug determinístico, sem acentos, único na página) e junta a lista em
 * `collector`. O sumário usa a MESMA lista, então os ids do sumário e os do HTML renderizado não divergem.
 * Também injeta `id` no `<Limites>` (que renderiza um `h2`) e o inclui na lista.
 */
export function rehypeArticleHeadings(collector: ArticleHeading[]) {
  return () => (tree: unknown) => {
    const used = new Set<string>(RESERVED_IDS);
    walk(tree as Node, (node) => {
      if (node.type === 'element' && node.tagName === 'h2') {
        const text = textOf(node).replace(/\s+/g, ' ').trim();
        if (!text) return;
        const current = node.properties?.id;
        const id = typeof current === 'string' && current ? current : uniqueId(slugify(text), used);
        node.properties = { ...(node.properties ?? {}), id };
        collector.push({ id, text });
        return;
      }
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Limites') {
        const attrs = (node.attributes ??= []);
        const custom = attrs.find((a) => a.name === 'titulo');
        const text = typeof custom?.value === 'string' ? custom.value : LIMITES_TITULO;
        if (!attrs.some((a) => a.name === 'id')) attrs.push({ type: 'mdxJsxAttribute', name: 'id', value: LIMITES_ID });
        collector.push({ id: LIMITES_ID, text });
      }
    });
  };
}
