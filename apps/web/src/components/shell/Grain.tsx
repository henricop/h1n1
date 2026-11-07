'use client';
/**
 * Grão de papel (`.paper-grain` de globals.css: SVG `feTurbulence` inline, sem rede). Some na "Versão simples"
 * (o CSS já o esconde em `deep`). Colocar DENTRO de um contêiner posicionado (palco), abaixo do texto.
 */
import { useSyncExternalStore } from 'react';
import { isSimpleMode, onSimpleMode } from '@/lib/motion/simple-mode';

const subscribe = (cb: () => void) => onSimpleMode(() => cb());
const serverSnapshot = () => false;

export function Grain({ className = '' }: { className?: string }) {
  const simple = useSyncExternalStore(subscribe, isSimpleMode, serverSnapshot);
  if (simple) return null;
  return <div aria-hidden="true" className={`paper-grain ${className}`} />;
}
