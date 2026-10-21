'use client';

/**
 * Último recurso quando o próprio layout raiz falha (substitui <html>/<body>).
 * Sem Tailwind aqui: o CSS global pode não ter carregado. Nenhum dado antigo é exibido como atual.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '4rem 1rem', color: '#0b1220', background: '#fff', fontSize: 17 }}>
        <main style={{ maxWidth: '40rem', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Algo deu errado</h1>
          <p style={{ marginTop: '0.75rem' }}>Não foi possível montar esta página agora. Nenhum dado antigo é exibido como atual.</p>
          {error.digest && <p style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>Referência: {error.digest}</p>}
          <p style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={reset} style={{ padding: '0.5rem 1rem', background: '#2451d6', color: '#fff', border: 0, borderRadius: '999px', minHeight: 44, cursor: 'pointer' }}>
              Tentar novamente
            </button>
            <a href="/" style={{ padding: '0.5rem', color: '#2451d6' }}>
              Voltar ao início
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
