/** Injeta dados estruturados (schema.org) como JSON-LD. Escapa '<' para evitar fechamento prematuro da tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
