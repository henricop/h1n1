'use client';
/**
 * Paleta de comandos global (⌘K / Ctrl+K ou `window.dispatchEvent(new CustomEvent('h1n1:palette'))`).
 * Grupos: Páginas, Indicadores, Comandos. Estilo HUD escuro, fonte mono, foco visível. Sem props.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { buildPaletteGroups, type PaletteGroup, type PaletteItem, type PalettePage } from '@/lib/terminal/palette-items';

export const PALETTE_EVENT = 'h1n1:palette';
/** Alias disparado pelo botão ⌘K da Sala de Situação. */
export const PALETTE_EVENT_ALIAS = 'h1n1:command-palette';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<PalettePage[] | null>(null);
  const [groups, setGroups] = useState<PaletteGroup[]>(() => buildPaletteGroups([]));
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Abre/fecha por atalho e por evento global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(PALETTE_EVENT, onEvent);
    window.addEventListener(PALETTE_EVENT_ALIAS, onEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(PALETTE_EVENT, onEvent);
      window.removeEventListener(PALETTE_EVENT_ALIAS, onEvent);
    };
  }, []);

  // Carrega as páginas elegíveis na primeira abertura; recalcula o CSV "atual" a cada abertura.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (pages) {
      setGroups(buildPaletteGroups(pages, search));
    } else {
      setGroups(buildPaletteGroups([], search));
      fetch('/api/palette')
        .then((r) => (r.ok ? r.json() : { pages: [] }))
        .then((j: { pages?: PalettePage[] }) => {
          const list = Array.isArray(j.pages) ? j.pages : [];
          setPages(list);
          setGroups(buildPaletteGroups(list, search));
        })
        .catch(() => setPages([]));
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, pages]);

  // Bloqueia o scroll do fundo enquanto aberta.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const select = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      if (item.action.type === 'navigate' || item.action.type === 'terminal') {
        router.push(item.action.type === 'navigate' ? item.action.href : '/terminal/');
      } else if (item.action.type === 'open') {
        window.open(item.action.url, '_blank', 'noopener');
      }
    },
    [router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-bg-950/80 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Paleta de comandos" className="hud-panel scanlines relative w-full max-w-xl overflow-hidden font-mono text-sm">
        <Command label="Paleta de comandos" loop className="flex max-h-[70vh] flex-col">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <span className="text-signal" aria-hidden="true">
              ⌘
            </span>
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="ir para uma página, indicador ou comando…"
              className="min-h-[44px] flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
            />
            <kbd className="hud-label rounded border border-line px-1.5 py-0.5">esc</kbd>
          </div>
          <Command.List className="overflow-y-auto p-2">
            <Command.Empty className="px-2 py-4 text-muted">nada encontrado.</Command.Empty>
            {groups.map((g) => (
              <Command.Group key={g.heading} heading={g.heading} className="mb-2 [&_[cmdk-group-heading]]:hud-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                {g.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.hint ?? ''} ${item.keywords.join(' ')}`}
                    onSelect={() => select(item)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-2 text-ink outline-none data-[selected=true]:bg-bg-700 data-[selected=true]:text-signal data-[selected=true]:ring-1 data-[selected=true]:ring-signal/50"
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 truncate text-[11px] text-faint">{item.hint}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <footer className="flex items-center justify-between border-t border-line px-3 py-1.5">
            <span className="hud-label">↑↓ navega · ⏎ abre · esc fecha</span>
            <span className="hud-label">⌘K / Ctrl+K</span>
          </footer>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
