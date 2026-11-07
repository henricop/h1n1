import { getGlossaryTerm } from '@/lib/glossary';
import { GlossarioTip } from './GlossarioTip';
import { markVirus } from './mark';

/**
 * Termo com definição acessível (foco, mouse e toque; Esc fecha). Termo desconhecido é renderizado sem tooltip.
 * A busca no glossário roda no servidor; só a parte interativa vai para o cliente.
 */
export function Glossario({ termo, children }: { termo: string; children?: React.ReactNode }) {
  const t = getGlossaryTerm(termo);
  const label = children ?? t?.term ?? termo;
  if (!t) return <span>{label}</span>;
  return (
    <GlossarioTip term={t.term} definition={t.definition}>
      {markVirus(label)}
    </GlossarioTip>
  );
}
