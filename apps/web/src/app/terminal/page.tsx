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
    <div className="-mx-4 -my-6 min-h-[calc(100vh-9rem)] bg-bg-950 px-2 py-3 sm:px-4">
      <h1 className="sr-only">Terminal de consulta epidemiológica</h1>
      <Terminal />
    </div>
  );
}
