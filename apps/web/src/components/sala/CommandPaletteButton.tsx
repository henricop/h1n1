'use client';
import { PALETTE_EVENT } from '@/components/terminal/CommandPalette';

/** Botão pílula "Buscar ⌘K": dispara um único evento global (h1n1:palette) que a CommandPalette escuta. */
export function CommandPaletteButton({ className = '' }: { className?: string }) {
  const open = () => window.dispatchEvent(new CustomEvent(PALETTE_EVENT));
  return (
    <button type="button" onClick={open} className={`btn btn-sm ${className}`} aria-label="Buscar no site e abrir comandos (⌘K ou Ctrl+K)" title="Buscar (⌘K)">
      <span>Buscar</span>
      <kbd className="rounded-full border border-line bg-bg-soft px-1.5 font-mono text-[11px] text-muted">⌘K</kbd>
    </button>
  );
}
