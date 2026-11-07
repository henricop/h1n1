import { Fato } from './Fato';
import { markVirus } from './mark';
import styles from './editorial.module.css';

interface Evento {
  data: string;
  titulo: string;
  fato_id?: string;
  descricao?: string;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'; 'AAAA-MM' → 'MM/AAAA'; 'AAAA' e textos livres ficam como estão. */
function formatEventDate(raw: string): { text: string; iso: string | null } {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return { text: `${m[3]}/${m[2]}/${m[1]}`, iso: raw };
  m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (m) return { text: `${m[2]}/${m[1]}`, iso: raw };
  if (/^\d{4}$/.test(raw)) return { text: raw, iso: raw };
  return { text: raw, iso: null };
}

/**
 * Linha do tempo editorial: filete vertical, datas em mono, títulos em serifa (≥ 28 px). Cada evento pode apontar
 * para um fato verificado (facts.json), exibido com fonte e verificador.
 */
export function LinhaDoTempo({
  eventos,
  items,
  titulo = 'Linha do tempo',
}: {
  eventos?: Evento[];
  /** alias usado pelo conteúdo editorial */
  items?: Evento[];
  titulo?: string;
}) {
  const lista = eventos ?? items ?? [];
  return (
    <section className="my-12 md:my-16" aria-label={titulo}>
      <ol className="my-0! ml-1.5! list-none! border-l-2 border-ink py-0! pl-7! md:ml-3! md:pl-12!">
        {lista.map((e, i) => {
          const d = formatEventDate(e.data);
          return (
            <li key={`${e.data}-${i}`} className="relative my-0! pb-12 last:pb-0">
              <span aria-hidden="true" className="absolute -left-[2.2rem] top-1 size-3 rounded-full border-2 border-ink bg-bg md:-left-[3.45rem]" />
              {d.iso ? (
                <time dateTime={d.iso} className="block font-mono text-[14px] font-medium tabular-nums text-muted">
                  {d.text}
                </time>
              ) : (
                <p className="font-mono text-[14px] font-medium text-muted">{d.text}</p>
              )}
              <p className={`${styles.serif} mt-2! mb-0! font-display text-[1.75rem] leading-[1.15] tracking-[-0.005em] text-ink md:text-[2rem]`}>{markVirus(e.titulo)}</p>
              {e.descricao && <p className="mt-2! mb-0! text-[17px] text-muted">{e.descricao}</p>}
              {e.fato_id && (
                <p className="mb-0! mt-3! text-[17px]">
                  <Fato id={e.fato_id} />
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
