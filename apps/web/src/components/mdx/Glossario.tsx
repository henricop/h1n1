import { getGlossaryTerm } from '@/lib/glossary';

/** Termo com definição acessível (hover e foco por teclado). Termo desconhecido é renderizado sem tooltip. */
export function Glossario({ termo, children }: { termo: string; children?: React.ReactNode }) {
  const t = getGlossaryTerm(termo);
  const label = children ?? t?.term ?? termo;
  if (!t) return <span>{label}</span>;
  const id = `gl-${termo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <span className="glossario" tabIndex={0} aria-describedby={id}>
      <dfn title={t.short} className="not-italic">
        {label}
      </dfn>
      <span id={id} role="tooltip" className="glossario-def">
        <strong>{t.term}</strong>: {t.definition}
      </span>
    </span>
  );
}
