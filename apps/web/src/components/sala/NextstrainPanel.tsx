'use client';
import { useState } from 'react';

const PRIMARY = 'https://nextstrain.org/seasonal-flu/h1n1pdm/ha/2y?sidebar=closed';
const FALLBACK = 'https://nextstrain.org/seasonal-flu/h1n1pdm/ha/2y';

/** Visualização externa do Nextstrain em iframe carregado só ao clicar (não baixamos nem redistribuímos o JSON). */
export function NextstrainPanel() {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <div className="relative min-h-[420px] overflow-hidden rounded border border-line bg-bg-950">
        {src ? (
          <iframe
            src={src}
            title="Nextstrain: filogenia de A(H1N1)pdm09 (HA, últimos 2 anos)"
            className="h-[560px] w-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups"
            onError={() => {
              if (src === PRIMARY) setSrc(FALLBACK);
              else setFailed(true);
            }}
          />
        ) : (
          <div className="scanlines relative flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="hud-label">Evolução do vírus · árvore filogenética</p>
            <p className="max-w-md text-sm text-muted">Mostra como as linhagens de A(H1N1)pdm09 (gene HA, últimos 2 anos) se relacionam. Conteúdo externo: carrega apenas ao clicar.</p>
            <button type="button" className="hud-btn hud-btn-primary" onClick={() => setSrc(PRIMARY)}>
              Carregar visualização do Nextstrain
            </button>
          </div>
        )}
      </div>
      {failed && <p className="mt-2 text-xs text-attention-700">Não foi possível carregar o Nextstrain aqui. Abra no site do projeto pelo link abaixo.</p>}
      {src && src !== PRIMARY && (
        <p className="mt-2 text-xs text-muted">
          <button type="button" className="underline" onClick={() => setSrc(FALLBACK)}>
            Recarregar sem parâmetros
          </button>
        </p>
      )}
    </div>
  );
}
