import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Integridade de cópia (plano 1.1 e 5.2): nenhum texto do site pode prometer "tempo real" / "ao vivo" /
 * "agora mesmo" / "surto perto" nem "casos de H1N1 na sua cidade". As expressões de imediatismo só são
 * toleradas em contexto negado (ex.: "não é um painel em tempo real"), na mesma frase e antes da expressão.
 */
const ROOTS = [path.join(process.cwd(), 'src'), path.join(process.cwd(), 'content'), path.join(process.cwd(), 'test', 'fixtures', 'content')];
const EXT = new Set(['.ts', '.tsx', '.mdx', '.md', '.json']);
const NEGATION = /\b(n[aã]o|nunca|jamais|nenhum[a]?|nem|sem|evit[ae]r?|nada de|deixou de|em vez de)\b/i;

/** Sempre proibidas, em qualquer contexto. */
export const FORBIDDEN_ALWAYS: readonly string[] = ['casos de h1n1 na sua cidade'];
/** Proibidas fora de contexto negado. 'tempo real' cobre também 'em tempo real'. */
export const FORBIDDEN_UNLESS_NEGATED: readonly string[] = ['tempo real', 'ao vivo', 'agora mesmo', 'surto perto'];

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

/** Contexto (mesma frase, antes da expressão) está negado? */
export function isNegatedContext(line: string, idx: number): boolean {
  const before = line.slice(Math.max(0, idx - 90), idx);
  const sentenceStart = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '), before.lastIndexOf(': '));
  const context = sentenceStart >= 0 ? before.slice(sentenceStart + 2) : before;
  return NEGATION.test(context);
}

export function lineViolations(line: string): string[] {
  const out: string[] = [];
  const lower = line.toLowerCase();
  for (const f of FORBIDDEN_ALWAYS) if (lower.includes(f)) out.push(`"${f}"`);
  for (const f of FORBIDDEN_UNLESS_NEGATED) {
    let idx = lower.indexOf(f);
    while (idx !== -1) {
      if (!isNegatedContext(line, idx)) out.push(`"${f}" fora de contexto negado`);
      idx = lower.indexOf(f, idx + 1);
    }
  }
  return out;
}

function violations(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, i) => lineViolations(line).map((v) => `${file}:${i + 1}: ${v}`));
}

describe('integridade de cópia', () => {
  it('não promete imediatismo nem "casos na sua cidade" em src/ e content/', () => {
    const files = ROOTS.flatMap((r) => walk(r));
    expect(files.length).toBeGreaterThan(0);
    const all = files.flatMap(violations);
    expect(all, all.join('\n')).toEqual([]);
  });

  it('lista de termos não tem duplicatas', () => {
    const all = [...FORBIDDEN_ALWAYS, ...FORBIDDEN_UNLESS_NEGATED];
    expect(new Set(all).size).toBe(all.length);
  });

  it('detector reconhece violações e contexto negado para cada termo', () => {
    // sanity check do próprio detector, sem gravar as frases proibidas no repositório
    for (const term of FORBIDDEN_UNLESS_NEGATED) {
      const bad = `painel de casos ${term}`;
      const negated = `não é um painel de casos ${term}`;
      const negatedOtherSentence = `Não é diagnóstico. Painel de casos ${term}`;
      expect(lineViolations(bad), term).toEqual([`"${term}" fora de contexto negado`]);
      expect(lineViolations(negated), term).toEqual([]);
      expect(lineViolations(negatedOtherSentence), term).toEqual([`"${term}" fora de contexto negado`]);
    }
    const city = ['casos de h1n1', ' na sua cidade'].join('');
    expect(lineViolations(`não mostramos ${city}`)).toEqual([`"${city}"`]);
    expect(lineViolations(`Não é um painel em ${['tempo', ' real'].join('')}`)).toEqual([]);
  });
});
