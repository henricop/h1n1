import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl py-16">
      <h1 className="text-3xl font-bold text-navy-900">Página não encontrada</h1>
      <p className="mt-3 text-muted">O endereço pode ter mudado ou o conteúdo ainda não foi publicado.</p>
      <ul className="mt-6 space-y-2">
        <li>
          <Link href="/">Voltar ao início</Link>
        </li>
        <li>
          <Link href="/dados/brasil/">H1N1 no Brasil (observatório)</Link>
        </li>
        <li>
          <Link href="/dados/fontes/">Fontes oficiais</Link>
        </li>
      </ul>
    </section>
  );
}
