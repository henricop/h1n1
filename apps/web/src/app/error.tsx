'use client';

import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-2xl py-16">
      <h1 className="text-3xl font-bold text-navy-900">Algo deu errado</h1>
      <p className="mt-3 text-muted">Não foi possível montar esta página agora. Nenhum dado antigo é exibido como atual.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Referência: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="touch rounded bg-navy-900 px-4 py-2 text-white">
          Tentar novamente
        </button>
        <Link href="/" className="touch inline-flex items-center px-2">
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}
