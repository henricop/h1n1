import { getFact } from '@/lib/content';

/**
 * Mesmo claim + nota de rodapé de <Fato>, com id de âncora prefixado pelo contexto (`ctx`), para que um
 * fato possa aparecer no capítulo, no painel da peça e na versão em texto sem ids duplicados no DOM.
 */
export function FatoCtx({ id, ctx }: { id: string; ctx: string }) {
  const f = getFact(id);
  const noteId = `fato-${ctx}-${id}`;
  return (
    <span className="fato">
      {f.claim}
      <sup className="ml-0.5">
        <a href={`#${noteId}`} aria-describedby={noteId} className="no-underline">
          [{id}]
        </a>
      </sup>
      <span id={noteId} role="note" className="mt-1 block text-xs text-muted">
        Fonte:{' '}
        <a href={f.source_url} rel="noopener noreferrer" target="_blank">
          {f.source_title}
        </a>
        {f.quote ? <> — “{f.quote}”</> : null}. Verificado por {f.verified_by} em {f.verified_at}.
      </span>
    </span>
  );
}
