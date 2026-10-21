'use client';
/**
 * Console de consulta epidemiológica: prompt `h1n1>`, histórico (↑/↓), autocomplete (Tab), ajuda.
 * Comandos locais (help, clear, abrir) resolvem no cliente; os demais vão a POST /api/terminal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INDICATORS } from '@h1n1/core';
import { OBSERVATORY_INDICATORS } from '@/lib/observatory';
import type { CommandOutput, OutputBlock } from '@/lib/terminal/format';
import { applyCompletion, completions, parseLine } from '@/lib/terminal/parser';
import { helpLines } from '@/lib/terminal/parser';

interface Entry {
  id: number;
  input?: string;
  blocks: OutputBlock[];
}

const BANNER: OutputBlock[] = [
  { kind: 'ok', lines: ['H1N1 · terminal de consulta epidemiológica'] },
  { kind: 'meta', lines: ['dados oficiais (SIVEP-Gripe, FluNet) via API /v1 · este painel não é "tempo real": cada saída mostra "base de DD/MM/AAAA".', 'digite help para os comandos. Exemplos: series sivep_srag_ah1n1pdm09_confirmed geo=BR-SP · top uf sivep_srag_notifications · status'] },
];

const KIND_CLASS: Record<OutputBlock['kind'], string> = {
  text: 'text-ink',
  table: 'text-ink',
  meta: 'text-muted',
  warn: 'text-attention-700',
  error: 'text-urgent-700',
  ok: 'font-semibold text-primary-600',
};

function localExecute(line: string): CommandOutput | null {
  const parsed = parseLine(line);
  if (!parsed.ok) return { blocks: [{ kind: 'error', lines: [parsed.error] }] };
  const c = parsed.command;
  if (c.name === 'help') return { blocks: [{ kind: 'text', lines: helpLines(c.positional[0]) }] };
  if (c.name === 'clear') return { blocks: [], action: { type: 'clear' } };
  if (c.name === 'abrir') return { blocks: [{ kind: 'text', lines: [`abrindo ${c.positional[0]}`] }], action: { type: 'navigate', href: c.positional[0]! } };
  return null;
}

export function Terminal() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([{ id: 0, blocks: BANNER }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seq = useRef(1);

  const indicatorIds = useMemo(() => [...new Set([...OBSERVATORY_INDICATORS.map((i) => i.id), ...INDICATORS.map((i) => i.id)])], []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries]);

  const push = useCallback((entry: Omit<Entry, 'id'>) => {
    setEntries((prev) => [...prev, { ...entry, id: seq.current++ }]);
  }, []);

  const run = useCallback(
    async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      setHistory((h) => (h[h.length - 1] === trimmed ? h : [...h, trimmed].slice(-100)));
      setHistIdx(null);
      setInput('');
      const local = localExecute(trimmed);
      if (local) {
        if (local.action?.type === 'clear') {
          setEntries([]);
          return;
        }
        push({ input: trimmed, blocks: local.blocks });
        if (local.action?.type === 'navigate') router.push(local.action.href);
        return;
      }
      setBusy(true);
      push({ input: trimmed, blocks: [{ kind: 'meta', lines: ['consultando a API…'] }] });
      try {
        const res = await fetch('/api/terminal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ line: trimmed }) });
        const out = (await res.json()) as CommandOutput;
        setEntries((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.input === trimmed) next[next.length - 1] = { ...last, blocks: out.blocks };
          return next;
        });
        if (out.action?.type === 'open') window.open(out.action.url, '_blank', 'noopener');
        if (out.action?.type === 'navigate') router.push(out.action.href);
      } catch (err) {
        setEntries((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.input === trimmed) next[next.length - 1] = { ...last, blocks: [{ kind: 'error', lines: ['Não foi possível falar com o servidor do site.', `detalhe: ${err instanceof Error ? err.message : String(err)}`] }] };
          return next;
        });
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [push, router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!busy) void run(input);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const opts = completions(input, indicatorIds);
      if (opts.length === 0) return;
      if (opts.length > 1) push({ blocks: [{ kind: 'meta', lines: [opts.join('  ')] }] });
      setInput(applyCompletion(input, opts));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      if (histIdx === null) setDraft(input);
      setHistIdx(idx);
      setInput(history[idx] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === null) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(null);
        setInput(draft);
      } else {
        setHistIdx(idx);
        setInput(history[idx] ?? '');
      }
      return;
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  return (
    <section
      className="card relative flex min-h-[calc(100vh-12rem)] flex-col overflow-hidden bg-bg-soft font-mono text-[13px] leading-relaxed text-ink md:text-[14px]"
      aria-label="Terminal de consulta epidemiológica"
      onClick={() => inputRef.current?.focus()}
    >
      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-2 font-sans">
        <span className="label">Terminal · API /v1</span>
        <span className="label" aria-live="polite">
          {busy ? 'consultando…' : 'pronto'}
        </span>
      </header>
      <div className="flex-1 overflow-x-auto px-4 py-3" role="log" aria-live="polite" aria-relevant="additions">
        {entries.map((e) => (
          <div key={e.id} className="mb-2">
            {e.input !== undefined && (
              <div className="whitespace-pre">
                <span className="font-semibold text-primary-600">h1n1&gt;</span> <span className="text-ink">{e.input}</span>
              </div>
            )}
            {e.blocks.map((b, i) => (
              <pre key={i} className={`whitespace-pre tabular-nums ${KIND_CLASS[b.kind]} ${b.kind === 'meta' ? 'whitespace-pre-wrap' : ''}`}>
                {b.lines.join('\n')}
              </pre>
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-center gap-2 border-t border-line bg-card px-4 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void run(input);
        }}
      >
        <label htmlFor="terminal-input" className="font-semibold text-primary-600">
          h1n1&gt;
        </label>
        <input
          id="terminal-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          aria-label="Comando do terminal"
          placeholder="help"
          className="min-h-[44px] flex-1 bg-transparent font-mono text-ink outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        />
        <button type="submit" className="btn btn-sm font-sans" disabled={busy}>
          Executar
        </button>
      </form>
    </section>
  );
}

export default Terminal;
