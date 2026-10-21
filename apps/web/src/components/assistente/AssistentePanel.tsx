'use client';
/** Stub: substituído pelo agente do assistente. Mantém a interface: componente sem props obrigatórias. */
export function AssistentePanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="hud-panel p-4" data-stub="assistente" data-compact={compact}>
      <p className="hud-label">Pergunte ao observatório</p>
      <p className="mt-2 text-sm text-muted">Assistente em construção.</p>
    </div>
  );
}
export default AssistentePanel;
