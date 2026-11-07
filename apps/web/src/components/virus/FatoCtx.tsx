import { FactCompact } from '@/components/home/FactCompact';

/**
 * Fato com id de âncora prefixado pelo contexto (`ctx`), para que um mesmo fato possa aparecer no filme, no
 * painel da peça e na versão em texto sem ids duplicados no DOM. Desde a v4 delega ao fato compacto da home.
 */
export function FatoCtx({ id, ctx }: { id: string; ctx: string }) {
  return <FactCompact id={id} ctx={ctx} />;
}
