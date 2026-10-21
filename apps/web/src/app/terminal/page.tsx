import type { Metadata } from 'next';
import { Terminal } from '@/components/terminal/Terminal';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terminal de consulta epidemiológica',
  description: 'Console para consultar séries, rankings por UF, nowcast, sinais estatísticos e frescor dos dados oficiais sobre H1N1, com fonte e base de cada número.',
  alternates: { canonical: `${SITE.url}/terminal/` },
  robots: { index: true, follow: true },
};

export default function TerminalPage() {
  return (
    <div>
      <header className="mb-6">
        <p className="kicker">Terminal</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-5xl">Consulte os dados por comandos</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Digite <code className="rounded bg-bg-soft px-1 font-mono text-[0.9em]">help</code> para ver os comandos. Toda saída traz fonte, data da base e o que os números representam.
        </p>
      </header>
      <Terminal />
    </div>
  );
}
