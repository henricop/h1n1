'use client';

import Link from 'next/link';
import { AlertSigns } from '@/components/AlertSigns';
import { FRAME, FRAME_TOP, KICKER } from '@/components/mdx/frame';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className={`${FRAME} ${FRAME_TOP} pb-24 md:pb-32`}>
      <p className={`${KICKER} mt-8 md:mt-12`}>
        <span aria-hidden="true">[ </span>erro<span aria-hidden="true"> ]</span>
      </p>
      <h1 className="display-xl mt-6 text-balance">Algo deu errado.</h1>
      <p className="lead mt-10 max-w-2xl md:mt-14">Não foi possível montar esta página agora. Nenhum dado antigo é exibido como atual.</p>
      {error.digest && <p className="mt-6 font-mono text-[14px] text-muted">Referência: {error.digest}</p>}
      <div className="mt-12 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Tentar novamente
        </button>
        <Link href="/" className="btn">
          Voltar ao início
        </Link>
      </div>
      <p className="mt-12 max-w-2xl border-l-2 border-ink pl-4 text-[15px] leading-snug text-ink md:text-base">
        <AlertSigns />
      </p>
    </section>
  );
}
