'use client';
import { useEffect, useState } from 'react';

const PRIMARY = 'https://nextstrain.org/seasonal-flu/h1n1pdm/ha/2y?sidebar=closed';
export const NEXTSTRAIN_LINK = 'https://nextstrain.org/seasonal-flu/h1n1pdm/ha/2y';
/** Tempo máximo para o iframe sinalizar `load`; depois disso mostramos o link fixo (achado k). */
export const NEXTSTRAIN_TIMEOUT_MS = 20_000;

/**
 * Visualização externa do Nextstrain em iframe carregado só ao clicar (não baixamos nem redistribuímos o JSON).
 * Sandbox sem allow-same-origin; fallback por timeout com link fixo para o site do projeto.
 */
export function NextstrainPanel() {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src || loaded) return;
    const id = window.setTimeout(() => setFailed(true), NEXTSTRAIN_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [src, loaded]);

  return (
    <div>
      <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-line bg-bg-soft">
        {src && !failed ? (
          <iframe
            src={src}
            title="Nextstrain: filogenia de A(H1N1)pdm09 (HA, últimos 2 anos)"
            className="h-[560px] w-full bg-white"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="label">Evolução do vírus · árvore filogenética</p>
            <p className="max-w-md text-[15px] text-muted">Mostra como as linhagens de A(H1N1)pdm09 (gene HA, últimos 2 anos) se relacionam. Conteúdo externo: carrega apenas ao clicar.</p>
            {failed ? (
              <p role="status" className="max-w-md rounded-2xl border border-attention-700/20 bg-attention-100 px-4 py-3 text-[14px] text-attention-700">
                Não foi possível carregar o Nextstrain aqui.{' '}
                <a href={NEXTSTRAIN_LINK} rel="noopener noreferrer" target="_blank" className="font-medium">
                  Abrir no site do Nextstrain
                </a>
                .
              </p>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setSrc(PRIMARY)}>
                Carregar visualização do Nextstrain
              </button>
            )}
          </div>
        )}
      </div>
      {src && !loaded && !failed && <p className="mt-2 text-[13px] text-muted" aria-live="polite">Carregando a visualização externa…</p>}
    </div>
  );
}
