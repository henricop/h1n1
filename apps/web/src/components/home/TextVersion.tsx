import { CHAPTERS } from '@/lib/virus/chapters';
import { CHAPTER_COPY } from '@/lib/virus/copy';
import { VIRUS_PARTS } from '@/lib/virus/parts';
import { ActKicker } from './ActKicker';
import { FactCompact } from './FactCompact';

/**
 * Versão em texto acessível do filme (id `versao-em-texto`): os passos e fatos dos cinco atos em texto corrido
 * e as peças do vírus com o que cada uma faz. É o alvo de "Pular a animação e ler em texto" e o que resta a
 * leitores de tela e a quem está sem WebGL ou na "Versão simples" (no palco, o pôster por ato).
 * Componente de servidor: renderiza os fatos com contexto próprio (`texto`, `peca-texto-<peça>`) para que um
 * fato compartilhado por duas peças não gere ids duplicados.
 */
export function TextVersion() {
  return (
    <section id="versao-em-texto" aria-labelledby="versao-em-texto-titulo" data-theme="paper" className="relative z-10 border-t border-line bg-bg px-5 py-20 md:px-10 lg:pl-[12.5rem] lg:pr-16">
      <p className="kicker-mono">Versão em texto</p>
      <h2 id="versao-em-texto-titulo" className="display-md mt-3">
        O filme, em texto corrido.
      </h2>
      <p className="mt-4 max-w-[44rem] text-[17px] leading-relaxed text-muted">Os mesmos cinco atos e as peças do vírus, com as fontes de cada afirmação: para quem pulou a animação, usa leitor de tela ou está sem o 3D.</p>
      {CHAPTERS.map((ch, i) => {
        const copy = CHAPTER_COPY[i]!;
        const hid = `texto-${ch.id}`;
        return (
          <article key={ch.id} aria-labelledby={hid} className="mt-14 max-w-[44rem]">
            <ActKicker index={ch.index} kicker={ch.kicker} />
            <h3 id={hid} className="mt-2 font-display text-[28px] leading-tight text-ink md:text-[34px]">
              {ch.title}
            </h3>
            {copy.steps.map((st, k) => (
              <div key={k} className="mt-5">
                <p className="text-[17px] leading-relaxed text-ink">{st.text}</p>
                {st.big && (
                  <div className="mt-3">
                    <FactCompact id={st.big.factId} ctx="texto" quoteFirst={st.big.preferQuote} />
                  </div>
                )}
                {st.factIds?.map((id) => (
                  <div key={id} className="mt-3">
                    <FactCompact id={id} ctx="texto" />
                  </div>
                ))}
                {st.note && <p className="mt-2 text-[14px] text-muted">{st.note}</p>}
              </div>
            ))}
          </article>
        );
      })}
      <h3 className="mt-16 font-display text-[28px] leading-tight text-ink md:text-[34px]">As peças do vírus e o que cada uma faz</h3>
      <dl className="mt-6 grid gap-8 md:grid-cols-2">
        {VIRUS_PARTS.map((p) => (
          <div key={p.id}>
            <dt className="font-display text-[28px] leading-tight text-ink">{p.label}</dt>
            <dd className="mt-2 text-[16px] leading-relaxed text-ink">
              {p.explanation.join(' ')}
              <div className="mt-3 space-y-3">
                {p.factIds.map((id) => (
                  <FactCompact key={id} id={id} ctx={`peca-texto-${p.id}`} />
                ))}
              </div>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
