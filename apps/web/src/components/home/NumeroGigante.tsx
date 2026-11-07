import { getFact } from '@/lib/content';
import { formatNumberBR } from '@/lib/format';
import type { BigMoment } from '@/lib/virus/copy';
import { FactCompact } from './FactCompact';
import { extractBigNumber } from './fact-utils';

/**
 * Número gigante do filme (atos 1 e 4) ou palavra gigante (ato 5), SEMPRE no mesmo bloco que o fato de origem:
 * o valor exibido é extraído do texto do fato (`extractBigNumber`), nunca digitado aqui. Se o fato não contiver
 * o número esperado, o bloco mostra só o fato (nunca um número inventado).
 */
export function NumeroGigante({ moment, ctx = 'filme' }: { moment: BigMoment; ctx?: string }) {
  const f = getFact(moment.factId);
  const big = moment.kind === 'word' ? null : extractBigNumber(moment.preferQuote && f.quote ? f.quote : f.claim, moment.kind);
  const word = moment.kind === 'word' ? moment.word : null;
  return (
    <figure className="m-0" data-big={moment.kind}>
      {word ? (
        <p className="bignum m-0 font-display" style={{ fontSize: 'clamp(3.5rem, 1.5rem + 8vw, 9rem)' }}>
          {word}
        </p>
      ) : big ? (
        <p className="m-0 flex flex-wrap items-baseline gap-x-3">
          {big.approx && <span className="font-display text-[clamp(1.5rem,1rem+1.6vw,2rem)] italic text-ink">cerca de</span>}
          <span className="bignum">{formatNumberBR(big.value)}</span>
          <span className="font-display text-[clamp(1.75rem,1rem+2.5vw,3.5rem)] text-ink">{big.unit}</span>
        </p>
      ) : null}
      {moment.caption && <p className="kicker-mono mt-2 text-muted">{moment.caption}</p>}
      <figcaption className="mt-3 max-w-[34rem]">
        <FactCompact id={moment.factId} ctx={ctx} quoteFirst={moment.preferQuote} />
      </figcaption>
    </figure>
  );
}
