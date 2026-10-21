import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl py-20 md:py-28">
      <p className="kicker">Erro 404</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-[-0.02em] text-ink md:text-5xl">Página não encontrada</h1>
      <p className="mt-4 text-muted">O endereço pode ter mudado ou o conteúdo ainda não foi publicado.</p>
      <ul className="mt-8 flex flex-wrap gap-3">
        <li>
          <Link href="/" className="btn btn-primary">
            Voltar ao início
          </Link>
        </li>
        <li>
          <Link href="/dados/brasil/" className="btn">
            H1N1 no Brasil
          </Link>
        </li>
        <li>
          <Link href="/sala/" className="btn">
            Sala de dados
          </Link>
        </li>
        <li>
          <Link href="/dados/fontes/" className="btn">
            Fontes oficiais
          </Link>
        </li>
      </ul>
    </section>
  );
}
