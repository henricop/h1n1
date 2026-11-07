/** Só no servidor (lê public/geo com fs): caminhos das UFs prontos para o SSR do `BrazilMap` (prop `paths`). */
import { loadBrUfFeatures } from '@/lib/geo-assets';
import { buildUfPaths, type UfPath } from './uf-paths';

/** `undefined` se a malha estiver indisponível: o `BrazilMap` então busca /geo/br-uf.geojson no cliente. */
export async function loadUfPaths(): Promise<UfPath[] | undefined> {
  const fc = await loadBrUfFeatures();
  return fc ? buildUfPaths(fc) : undefined;
}
