'use client';
/**
 * Ato 0 · Abertura (contrato v4 §1/§6). Fica DENTRO do contêiner do filme, antes do ato 1, sobre o palco sticky:
 * "H1N1" em condensada gigante com o vírion 3D passando por trás das letras (`mix-blend-mode: multiply` só em
 * papel), H1 acessível completo, subtítulo, "Começar" (rola ao ato 1), "Pular a animação e ler em texto" e
 * "Estou com sintomas" (só se a página for elegível). Entrada por keyframes CSS (sem FOUC; desligada em
 * `prefers-reduced-motion` e na "Versão simples").
 */
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { scrollToEl } from '@/lib/motion/lenis';
import { OPENING } from '@/lib/virus/copy';

const CSS = `@keyframes h1n1-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.opening-rise{animation:h1n1-rise .7s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--d,0s)}
@media (prefers-reduced-motion:reduce){.opening-rise{animation:none}}
html[data-simple="1"] .opening-rise{animation:none}`;

const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

interface Props {
  /** href de /sintomas/sinais-de-alerta/ (ou null se a página não for elegível) */
  alertaHref: string | null;
  reduced: boolean;
}

export function Opening({ alertaHref, reduced }: Props) {
  const start = () => {
    const first = document.querySelector('#ato-01 [data-step]') ?? document.getElementById('ato-01');
    scrollToEl(first, { reduced });
  };
  return (
    <section id="abertura" aria-labelledby="titulo-home" data-theme="paper" className="pointer-events-none relative z-10 flex min-h-[100svh] flex-col justify-start px-5 pb-12 pt-[48svh] md:px-10 lg:pb-10 lg:pl-[12.5rem] lg:pr-[28vw] lg:pt-24">
      <style href="h1n1-opening" precedence="default">
        {CSS}
      </style>
      <div className="pointer-events-auto max-w-[52rem]">
        <p className="kicker-mono opening-rise" style={delay(0)}>
          <span aria-hidden="true">[ </span>
          {OPENING.tag}
          <span aria-hidden="true"> ]</span>
        </p>
        <h1 id="titulo-home" className="mt-4">
          <span className="sr-only">{OPENING.title}</span>
          <span aria-hidden="true" className="block">
            {/* a palavra fica um degrau abaixo do teto da escala para a abertura caber em 900 px de altura */}
            <span className="condensed-xl opening-rise block mix-blend-multiply [html[data-theme-current=deep]_&]:mix-blend-normal" style={{ ...delay(0.05), fontSize: 'clamp(6rem, 2rem + 17vw, 20rem)' }}>
              {OPENING.word}
            </span>
            <span className="display-lg opening-rise mt-2 block" style={delay(0.12)}>
              {OPENING.titleRest}
            </span>
          </span>
        </h1>
        <p className="lead opening-rise mt-5 max-w-[44rem]" style={delay(0.2)}>
          {OPENING.lead}
        </p>
        <div className="opening-rise mt-6 flex flex-wrap items-center gap-3" style={delay(0.28)}>
          <button type="button" onClick={start} className="btn btn-primary px-7">
            {OPENING.start}
          </button>
          <a href="#versao-em-texto" className="btn">
            {OPENING.skip}
          </a>
          {alertaHref && (
            <Link href={alertaHref} className="btn btn-h1n1">
              {OPENING.symptoms}
            </Link>
          )}
        </div>
        <p className="kicker-mono opening-rise mt-6" style={delay(0.4)}>
          {OPENING.hint} <span aria-hidden="true">↓</span>
        </p>
      </div>
    </section>
  );
}
