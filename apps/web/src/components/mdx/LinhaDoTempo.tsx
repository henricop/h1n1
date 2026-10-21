import { getFact } from '@/lib/content';

interface Evento {
  data: string;
  titulo: string;
  fato_id?: string;
  descricao?: string;
}

/** Lista de eventos datados; cada evento pode apontar para um fato verificado (facts.json). */
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
    <section className="my-6" aria-label={titulo}>
      <ol className="relative border-l-2 border-navy-100 pl-5">
        {lista.map((e, i) => {
          const fato = e.fato_id ? getFact(e.fato_id) : null;
          return (
            <li key={`${e.data}-${i}`} className="relative mb-6">
              <span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-navy-700 bg-paper" />
              <time dateTime={e.data} className="text-sm font-semibold text-signal">
                {e.data}
              </time>
              <p className="font-medium">{e.titulo}</p>
              {e.descricao && <p className="text-sm text-muted">{e.descricao}</p>}
              {fato && (
                <p className="mt-1 text-xs text-muted">
                  {fato.claim} Fonte:{' '}
                  <a href={fato.source_url} rel="noopener noreferrer" target="_blank">
                    {fato.source_title}
                  </a>{' '}
                  (verificado em {fato.verified_at}).
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
