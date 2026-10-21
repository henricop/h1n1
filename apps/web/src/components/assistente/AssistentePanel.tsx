'use client';
/**
 * Painel "Pergunte ao observatório": chat com streaming (useChat), sugestões, chamadas de ferramenta como linhas
 * de console, citações como links e aviso fixo. Sem persistência; sem dados pessoais. `compact` reduz a altura.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from 'ai';
import { isAllowedModelLink, isCitationUrl } from '@/lib/assistant/links';

const SUGGESTIONS = ['Como está o H1N1 no Brasil nas últimas semanas?', 'Qual a diferença entre SRAG e H1N1 confirmado?', 'Quais UFs têm sinal estatístico?'] as const;

const DISABLED_TEXT = 'Assistente desativado nesta instalação (defina ANTHROPIC_API_KEY).';
const MAX_CHARS = 2_000;

interface Citation {
  label: string;
  url: string;
}


function citationsOf(message: UIMessage): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== 'output-available') continue;
    const output = part.output as { citations?: unknown } | undefined;
    const list = Array.isArray(output?.citations) ? (output!.citations as unknown[]) : [];
    for (const c of list) {
      if (typeof c !== 'object' || c === null) continue;
      const { label, url } = c as { label?: unknown; url?: unknown };
      if (typeof url !== 'string' || typeof label !== 'string' || !isCitationUrl(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({ label, url });
    }
  }
  return out;
}

/**
 * Markdown mínimo: parágrafos, listas "- ", **negrito** e [rótulo](url). Nada de HTML cru.
 * Links só quando forem rotas internas ou coincidirem com uma citação devolvida por ferramenta (achado d).
 */
function renderInline(text: string, keyPrefix: string, allowed: ReadonlySet<string>): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined && m[2] !== undefined) {
      nodes.push(
        isAllowedModelLink(m[2], allowed) ? (
          <a key={`${keyPrefix}-${i++}`} href={m[2]} target={m[2].startsWith('/') ? undefined : '_blank'} rel={m[2].startsWith('/') ? undefined : 'noopener noreferrer'}>
            {m[1]}
          </a>
        ) : (
          m[1]
        ),
      );
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`}>{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ text, allowed }: { text: string; allowed: ReadonlySet<string> }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="my-1 list-disc pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-*•]\s+/, ''), `${bi}-${li}`, allowed)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="my-1">
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l, `${bi}-${li}`, allowed)}
                {li < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function toolLine(part: UIMessage['parts'][number]): string | null {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  const input = part.input && typeof part.input === 'object' ? Object.values(part.input as Record<string, unknown>).filter((v) => v !== undefined && v !== '').map(String) : [];
  const status = part.state === 'output-error' ? ' ✗' : part.state === 'output-available' ? '' : ' …';
  return `▸ ${name}${input.length ? ' ' + input.join(' ') : ''}${status}`;
}

export function AssistentePanel({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);
  const { messages, sendMessage, status, error, stop, clearError } = useChat({
    transport,
    onError: (err) => {
      if (/assistant_disabled|ANTHROPIC_API_KEY/.test(err.message)) setEnabled(false);
    },
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/chat', { method: 'GET' })
      .then((r) => !cancelled && setEnabled(r.ok))
      .catch(() => !cancelled && setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy || enabled === false) return;
    if (t.length > MAX_CHARS) return;
    clearError();
    setInput('');
    void sendMessage({ text: t });
  };

  const errorText = error ? (/assistant_disabled|ANTHROPIC_API_KEY/.test(error.message) ? DISABLED_TEXT : /rate_limited|429/.test(error.message) ? 'Muitas perguntas em pouco tempo. Aguarde alguns minutos.' : 'Falha ao consultar o assistente. Tente novamente.') : null;

  return (
    <section className="card relative flex flex-col overflow-hidden" aria-label="Pergunte ao observatório" data-compact={compact}>
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="font-display text-lg font-bold tracking-[-0.01em] text-ink">Pergunte ao observatório</p>
        <p className="label" aria-live="polite">
          {enabled === false ? 'desativado' : busy ? 'respondendo…' : 'assistente com IA'}
        </p>
      </header>

      <div ref={logRef} className={`${compact ? 'max-h-56' : 'max-h-[28rem]'} min-h-24 overflow-y-auto px-4 py-3 text-sm`} role="log" aria-live="polite" aria-relevant="additions">
        {enabled === false && <p className="text-attention-700">{DISABLED_TEXT}</p>}
        {enabled !== false && messages.length === 0 && (
          <p className="text-muted">Perguntas sobre os dados oficiais de H1N1, SRAG e influenza no Brasil. Cada número vem com fonte, data da base e o que ele representa.</p>
        )}
        {messages.map((m) => {
          const cites = m.role === 'assistant' ? citationsOf(m) : [];
          const allowed = new Set(cites.map((c) => c.url));
          const mine = m.role === 'user';
          return (
            <div key={m.id} className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${mine ? 'bg-primary-600 text-white' : 'bg-bg-soft text-ink'}`}>
              <p className={`text-[12px] ${mine ? 'text-white/80' : 'text-muted'}`}>{mine ? 'Você' : 'Observatório'}</p>
              {m.parts.map((part, i) => {
                if (part.type === 'text') {
                  return mine ? (
                    <p key={i} className="my-1 whitespace-pre-wrap">
                      {part.text}
                    </p>
                  ) : (
                    <div key={i} className="text-ink">
                      <Markdown text={part.text} allowed={allowed} />
                    </div>
                  );
                }
                const line = toolLine(part);
                if (line) {
                  return (
                    <p key={i} className="my-0.5 whitespace-pre-wrap text-[12px] text-primary-700">
                      {line}
                    </p>
                  );
                }
                return null;
              })}
              {cites.length > 0 && (
                <p className="mt-1 text-[12px] text-muted">
                  Fontes:{' '}
                  {cites.map((c, i) => (
                    <span key={c.url}>
                      <a href={c.url} target={c.url.startsWith('/') ? undefined : '_blank'} rel={c.url.startsWith('/') ? undefined : 'noopener noreferrer'}>
                        {c.label}
                      </a>
                      {i < cites.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              )}
              </div>
            </div>
          );
        })}
        {busy && <p className="text-[13px] text-muted">Consultando os dados…</p>}
        {errorText && (
          <p className="text-[13px] text-urgent-700" role="alert">
            {errorText}
          </p>
        )}
      </div>

      {enabled !== false && messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} disabled={busy} className="chip text-left">
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="assistente-input" className="sr-only">
          Sua pergunta
        </label>
        <textarea
          id="assistente-input"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={compact ? 1 : 2}
          maxLength={MAX_CHARS}
          disabled={enabled === false || busy}
          placeholder={enabled === false ? 'assistente desativado' : 'pergunte sobre os dados (sem dados de saúde pessoais)'}
          className="input-field flex-1 resize-none text-[15px]"
        />
        {busy ? (
          <button type="button" onClick={() => stop()} className="btn">
            Parar
          </button>
        ) : (
          <button type="submit" disabled={enabled === false || !input.trim()} className="btn btn-primary">
            Perguntar
          </button>
        )}
      </form>
      <footer className="border-t border-line bg-bg-soft px-5 py-3 text-[12px] leading-snug text-muted">
        Conteúdo educativo gerado por IA a partir de dados oficiais; não substitui avaliação médica. Em sinais de alerta, procure um serviço de saúde (
        <a href="/sintomas/sinais-de-alerta/">sinais de alerta</a>). Não envie dados de saúde pessoais. A conversa não é armazenada. {input.length > 0 && <span className="tabular-nums">{input.length}/{MAX_CHARS}</span>}
      </footer>
    </section>
  );
}

export default AssistentePanel;
