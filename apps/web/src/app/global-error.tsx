'use client';

/**
 * Último recurso quando o próprio layout raiz falha (substitui <html>/<body>).
 * Sem Tailwind nem fontes do site: o CSS global pode não ter carregado, então usa estilos inline na paleta v3
 * (papel #f4f1ea, tinta #14130f, cobalto #2451d6) e serifa do sistema. Nenhum dado antigo é exibido como atual.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', margin: 0, padding: '5rem 1.25rem 4rem', color: '#14130f', background: '#f4f1ea', fontSize: 18, lineHeight: 1.6 }}>
        <main style={{ maxWidth: '44rem', margin: '0 auto' }}>
          <p style={{ margin: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14, color: '#4d4a42' }}>[ erro ]</p>
          <h1 style={{ margin: '1rem 0 0', fontFamily: '"Iowan Old Style", Georgia, serif', fontWeight: 400, fontSize: 'clamp(2.75rem, 10vw, 5rem)', lineHeight: 1, letterSpacing: '-0.01em' }}>Algo deu errado.</h1>
          <p style={{ margin: '1.5rem 0 0', fontFamily: '"Iowan Old Style", Georgia, serif', fontStyle: 'italic', fontSize: 'clamp(1.5rem, 4vw, 1.875rem)', lineHeight: 1.25 }}>
            Não foi possível montar esta página agora. Nenhum dado antigo é exibido como atual.
          </p>
          {error.digest && <p style={{ margin: '1.25rem 0 0', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14, color: '#4d4a42' }}>Referência: {error.digest}</p>}
          <p style={{ margin: '2rem 0 0', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={reset} style={{ padding: '0.5rem 1.25rem', background: '#2451d6', color: '#fff', border: 0, borderRadius: 999, minHeight: 48, fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>
              Tentar novamente
            </button>
            <a href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, padding: '0 0.5rem', color: '#2451d6' }}>
              Voltar ao início
            </a>
          </p>
          <p style={{ margin: '2.5rem 0 0', paddingLeft: '1rem', borderLeft: '2px solid #14130f', fontSize: 16, lineHeight: 1.5 }}>
            Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em <a href="/sintomas/sinais-de-alerta/" style={{ color: '#2451d6' }}>/sintomas/sinais-de-alerta/</a>.
          </p>
        </main>
      </body>
    </html>
  );
}
