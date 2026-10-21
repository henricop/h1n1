import { getFact } from '@/lib/content';

/**
 * Renderiza um claim verificado de content/facts.json com nota de rodapé inline (fonte, data, verificador).
 * Se o id não existir, lança ContentError → o build falha.
 */
export function Fato({ id }: { id: string }) {
  const f = getFact(id);
  const noteId = `fato-${id}`;
  return (
    <span className="fato">
      {f.claim}
      <sup className="ml-0.5">
        <a href={`#${noteId}`} aria-describedby={noteId} className="no-underline">
          [{id}]
        </a>
      </sup>
      <span id={noteId} role="note" className="mt-1 block text-xs text-muted">
        Fonte: <a href={f.source_url} rel="noopener noreferrer" target="_blank">{f.source_title}</a>
        {f.quote ? <> — “{f.quote}”</> : null}. Verificado por {f.verified_by} em {f.verified_at}.
      </span>
    </span>
  );
}
