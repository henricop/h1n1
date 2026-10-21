'use client';

/**
 * Botão ⌘K do HUD. A paleta (components/terminal/CommandPalette, de outro agente) escuta o atalho de teclado;
 * aqui despachamos o mesmo atalho como evento sintético e um evento customizado, sem acoplar à implementação.
 */
export function CommandPaletteButton({ className = '' }: { className?: string }) {
  const open = () => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    const init: KeyboardEventInit = { key: 'k', code: 'KeyK', metaKey: isMac, ctrlKey: !isMac, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', init));
    window.dispatchEvent(new KeyboardEvent('keydown', init));
    window.dispatchEvent(new CustomEvent('h1n1:command-palette', { detail: { open: true } }));
  };
  return (
    <button type="button" onClick={open} className={`hud-btn ${className}`} aria-label="Abrir paleta de comandos (⌘K ou Ctrl+K)" title="Paleta de comandos">
      <kbd className="font-mono text-[11px]">⌘K</kbd>
      <span className="hidden sm:inline">Comandos</span>
    </button>
  );
}
