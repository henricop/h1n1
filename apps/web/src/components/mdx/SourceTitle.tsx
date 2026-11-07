import { isEnglish, splitSourceTitle } from './lang';

/**
 * Título de fonte ("OMS — Disease Outbreak News, ..."): o trecho do documento em inglês ganha `lang="en"` (WCAG
 * 3.1.2) e a sigla do órgão fica em português. Títulos em português saem como estão.
 */
export function SourceTitle({ title }: { title: string }) {
  const { org, title: doc } = splitSourceTitle(title);
  if (isEnglish(doc, 2)) {
    return (
      <>
        {org ? `${org} — ` : null}
        <span lang="en">{doc}</span>
      </>
    );
  }
  return <>{title}</>;
}
