'use client';

import { useEffect, useState } from 'react';
import type { ArticleHeading } from './headings';

/**
 * Sumário lateral ("Nesta página"): lista dos `##` do artigo; no desktop fica fixo (sticky) na coluna da direita e
 * destaca a seção em leitura (`aria-current="location"`). Links são âncoras reais (funcionam sem JS); o realce é
 * só reforço visual. Sem live region.
 */
export function ArticleToc({ items }: { items: ArticleHeading[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => e !== null);
    if (els.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // seção em leitura = última cujo título já passou da linha de referência (um quarto da altura da janela)
      const line = window.innerHeight * 0.28;
      let current: string | null = null;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) current = el.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav aria-labelledby="toc-titulo">
      <p id="toc-titulo" className="font-mono text-[14px] leading-none text-muted">
        <span aria-hidden="true">[ </span>nesta página<span aria-hidden="true"> ]</span>
      </p>
      <ol className="mt-5 space-y-1 border-l border-line-strong">
        {items.map((i) => {
          const on = i.id === active;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                aria-current={on ? 'location' : undefined}
                className={`-ml-px flex min-h-11 items-center border-l-2 py-1 pl-4 text-[15px] leading-snug no-underline hover:text-ink ${on ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted'}`}
              >
                {i.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
