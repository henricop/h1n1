import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Integridade de cópia (plano 1.1 e 5.2): nenhum texto do site pode prometer "tempo real"
 * nem "casos de H1N1 na sua cidade". A expressão "tempo real" só é tolerada em contexto negado
 * (ex.: "não é um painel em tempo real"), na mesma linha e antes da expressão.
 */
const ROOTS = [path.join(process.cwd(), 'src'), path.join(process.cwd(), 'content'), path.join(process.cwd(), 'test', 'fixtures', 'content')];
const EXT = new Set(['.ts', '.tsx', '.mdx', '.md', '.json']);
const NEGATION = /\b(n[aã]o|nunca|jamais|nenhum[a]?|nem|sem|evit[ae]r?|nada de|deixou de|em vez de)\b/i;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    // README e scripts de validação não são cópia publicada: descrevem a própria regra.
    else if (EXT.has(path.extname(f)) && e !== 'README.md' && !f.includes(`${path.sep}scripts${path.sep}`)) out.push(f);
  }
  return out;
}

function violations(file: string): string[] {
  const out: string[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    const forbidden = ['casos de h1n1 na sua cidade', 'casos de h1n1 na sua cidade'];
    for (const f of forbidden) if (lower.includes(f)) out.push(`${file}:${i + 1}: "${f}"`);
    let idx = lower.indexOf('tempo real');
    while (idx !== -1) {
      const before = line.slice(Math.max(0, idx - 90), idx);
      const sentenceStart = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '), before.lastIndexOf(': '));
      const context = sentenceStart >= 0 ? before.slice(sentenceStart + 2) : before;
      if (!NEGATION.test(context)) out.push(`${file}:${i + 1}: "tempo real" fora de contexto negado`);
      idx = lower.indexOf('tempo real', idx + 1);
    }
  });
  return out;
}

describe('integridade de cópia', () => {
  it('não promete "tempo real" nem "casos na sua cidade" em src/ e content/', () => {
    const files = ROOTS.flatMap((r) => walk(r));
    expect(files.length).toBeGreaterThan(0);
    const all = files.flatMap(violations);
    expect(all, all.join('\n')).toEqual([]);
  });

  it('detector reconhece violações e contexto negado', () => {
    // sanity check do próprio detector, sem gravar as frases proibidas no repositório
    const bad = ['painel em ', 'tempo', ' real'].join('');
    const negated = 'não é um painel em ' + ['tempo', ' real'].join('');
    expect(NEGATION.test(negated.slice(0, negated.indexOf('tempo')))).toBe(true);
    expect(NEGATION.test(bad.slice(0, bad.indexOf('tempo')))).toBe(false);
  });
});
