import { getFact, type Fact } from '@/lib/content';
import { formatDateBR } from '@/lib/format';
import { isEnglish } from './lang';
import { SourceTitle } from './SourceTitle';

const CHIP =
  'ml-1.5 inline-flex min-h-7 items-center rounded-full border border-primary-600/30 bg-primary-50 px-2.5 align-baseline font-sans text-[14px] font-semibold not-italic leading-none tracking-normal text-primary-700 no-underline hover:border-primary-600 hover:bg-primary-100';

/**
 * Afirmação resumida para o nome acessível: inteira se curta; senão início + fim ("começo… final"), porque
 * afirmações longas podem começar igual (ex.: sinais de agravamento de adultos e de crianças).
 */
function excerpt(claim: string, head = 60, tail = 40): string {
  const text = claim.replace(/\s+/g, ' ').trim();
  if (text.length <= head + tail + 20) return text;
  const start = text.slice(0, head);
  const end = text.slice(-tail);
  return `${start.slice(0, Math.max(start.lastIndexOf(' '), 20))}… ${end.slice(end.indexOf(' ') + 1)}`;
}

/**
 * Nome acessível ÚNICO por fato (WCAG 2.4.4 / 2.5.3): começa com a palavra visível "Fonte", traz o documento e o
 * início da afirmação, porque vários fatos compartilham o mesmo documento.
 */
export function fatoAriaLabel(f: Pick<Fact, 'claim' | 'source_title'>): string {
  return `Fonte: ${f.source_title}. Afirmação: ${excerpt(f.claim)}`;
}

/**
 * Afirmação verificada de content/facts.json: texto da afirmação, chip "fonte" (link externo com nome acessível
 * único) e, logo abaixo, a nota com documento, citação literal (com `lang="en"` quando em inglês) e quem verificou.
 * Se o id não existir, lança ContentError → o build falha.
 */
export function Fato({ id }: { id: string }) {
  const f = getFact(id);
  const quoteIsEnglish = f.quote ? isEnglish(f.quote) : false;
  return (
    <span className="fato">
      <span className="fato-claim">{f.claim}</span>
      <a href={f.source_url} rel="noopener noreferrer" target="_blank" aria-label={fatoAriaLabel(f)} className={CHIP}>
        fonte
      </a>
      <span role="note" className="mb-3 mt-2 block border-l-2 border-line-strong pl-4 font-sans text-[15px] font-normal not-italic leading-snug tracking-normal text-muted">
        <span className="block">
          Fonte:{' '}
          <a href={f.source_url} rel="noopener noreferrer" target="_blank">
            <SourceTitle title={f.source_title} />
          </a>
        </span>
        {f.quote ? (
          <span className="mt-1.5 block">
            <span className="font-mono text-[14px]">{quoteIsEnglish ? 'citação literal, em inglês:' : 'citação literal:'}</span>{' '}
            <span lang={quoteIsEnglish ? 'en' : undefined} className="italic">
              “{f.quote}”
            </span>
          </span>
        ) : null}
        <span className="mt-1.5 block font-mono text-[14px]">
          verificado por {f.verified_by} em {formatDateBR(f.verified_at)}
        </span>
      </span>
    </span>
  );
}
