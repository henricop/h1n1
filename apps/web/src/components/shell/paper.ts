/**
 * A interface (pílulas, marca, trilho, Menu) fica em papel claro OPACO em qualquer tema (docs/reformulacao-v4.md §6:
 * "o mundo escurece; a interface não"). `PAPER_VARS` reescreve os tokens de cor no elemento para que os
 * utilitários (`bg-bg`, `text-ink`, `border-line`…) resolvam para o tema `paper` dentro dele, mesmo com o
 * `<html>` em `deep` ou interpolando.
 */
import type { CSSProperties } from 'react';
import { THEMES } from '@/lib/motion/theme';

export const PAPER_VARS = { ...THEMES.paper, colorScheme: 'light' } as CSSProperties;

/** Cores literais do papel da interface (iguais a `.pill` em globals.css). */
export const UI = {
  surface: '#fbfaf7',
  ink: '#14130f',
  muted: '#4d4a42',
  border: '#8a8475',
} as const;
