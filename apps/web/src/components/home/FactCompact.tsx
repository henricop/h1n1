import { getFact } from '@/lib/content';
import { claimExcerpt, quoteLang, shortSource } from './fact-utils';

/**
 * Fato compacto para o filme (contrato v4 §6): afirmação + fonte curta sempre visíveis; citação (com
 * `lang="en"` quando em inglês) e "verificado por" atrás de um <details> com alvo de 44 px. O link "fonte" tem
 * `aria-label` único por fato. O mesmo fato pode aparecer em mais de um contexto (filme, painel da peça,
 * versão em texto): `ctx` prefixa os ids para não haver duplicata no DOM.
 *
 * Dentro do véu só `ink`/`muted` (nunca `faint`); o link tem fundo próprio. Nenhum texto abaixo de 14 px.
 */
export function FactCompact({ id, ctx = 'filme', quoteFirst = false }: { id: string; ctx?: string; quoteFirst?: boolean }) {
  const f = getFact(id);
  const short = shortSource(f.source_title);
  const lang = quoteLang(f.quote) === 'en' ? 'en' : undefined;
  const detailsId = `fato-${ctx}-${id}`;
  // quando o claim omite uma ressalva que a citação (em português) preserva, a citação é o texto visível
  const showQuoteAsClaim = quoteFirst && Boolean(f.quote) && lang === undefined;
  return (
    <div className="fato text-[15px] leading-relaxed text-ink">
      <p className="m-0">
        {showQuoteAsClaim ? <q lang={lang}>{f.quote}</q> : f.claim}{' '}
        <a
          href={f.source_url}
          rel="noopener noreferrer"
          target="_blank"
          aria-label={`Fonte da afirmação "${claimExcerpt(f.claim)}": ${short} (abre em nova aba)`}
          className="ml-1 inline-flex min-h-[28px] items-center rounded-full bg-primary-50 px-2.5 py-0.5 align-middle font-mono text-[14px] font-medium text-primary-700 no-underline hover:bg-primary-100"
        >
          fonte: {short}
        </a>
      </p>
      <details id={detailsId} className="mt-1">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 font-mono text-[14px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">+</span> citação e verificação
        </summary>
        <div className="pb-2 text-[14px] leading-relaxed text-muted">
          {f.quote && !showQuoteAsClaim ? (
            <p className="m-0">
              <q lang={lang}>{f.quote}</q>
            </p>
          ) : null}
          <p className="m-0 mt-1">
            {f.source_title}. Verificado por {f.verified_by} em {f.verified_at}.
          </p>
        </div>
      </details>
    </div>
  );
}
