'use client';

import Link from 'next/link';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-2xl py-20 md:py-28">
      <p className="kicker">Erro</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-[-0.02em] text-ink md:text-5xl">Algo deu errado</h1>
      <p className="mt-4 text-muted">Não foi possível montar esta página agora. Nenhum dado antigo é exibido como atual.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-faint">Referência: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Tentar novamente
        </button>
        <Link href="/" className="btn">
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}
