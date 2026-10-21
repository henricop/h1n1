'use client';
/**
 * Paleta de comandos global (⌘K / Ctrl+K ou `window.dispatchEvent(new CustomEvent('h1n1:palette'))`).
 * Grupos: Páginas, Indicadores, Comandos. Tema claro; foco visível; armadilha de foco simples (Tab circula no diálogo);
 * a busca é zerada só quando a paleta abre (achado l).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { buildPaletteGroups, type PaletteGroup, type PaletteItem, type PalettePage } from '@/lib/terminal/palette-items';

export const PALETTE_EVENT = 'h1n1:palette';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<PalettePage[] | null>(null);
  const [groups, setGroups] = useState<PaletteGroup[]>(() => buildPaletteGroups([]));
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

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
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(PALETTE_EVENT, onEvent);
    };
  }, []);

  // Ao abrir: zera a busca, guarda o foco anterior, recalcula o CSV "atual" e carrega as páginas uma vez.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const search = window.location.search;
    setGroups(buildPaletteGroups(pages ?? [], search));
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
    // `pages` é lido no momento da abertura; a carga abaixo atualiza os grupos quando chegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || pages) return;
    let alive = true;
    fetch('/api/palette')
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((j: { pages?: PalettePage[] }) => {
        if (!alive) return;
        const list = Array.isArray(j.pages) ? j.pages : [];
        setPages(list);
        setGroups(buildPaletteGroups(list, window.location.search));
      })
      .catch(() => alive && setPages([]));
    return () => {
      alive = false;
    };
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

  // Armadilha de foco simples: Tab/Shift+Tab circulam dentro do diálogo.
  const trapFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Buscar e comandos" className="card relative w-full max-w-xl overflow-hidden text-[15px]" onKeyDown={trapFocus}>
        <Command label="Buscar e comandos" loop className="flex max-h-[70vh] flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4">
            <span className="text-primary-600" aria-hidden="true">
              ⌘
            </span>
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar página, indicador ou comando…"
              className="min-h-[48px] flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
            />
            <kbd className="rounded-full border border-line bg-bg-soft px-2 py-0.5 font-mono text-[11px] text-muted">esc</kbd>
          </div>
          <Command.List className="overflow-y-auto p-2">
            <Command.Empty className="px-3 py-4 text-muted">Nada encontrado.</Command.Empty>
            {groups.map((g) => (
              <Command.Group key={g.heading} heading={g.heading} className="mb-2 [&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1">
                {g.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.hint ?? ''} ${item.keywords.join(' ')}`}
                    onSelect={() => select(item)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-ink outline-none data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700"
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 truncate text-[12px] text-faint">{item.hint}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <footer className="flex items-center justify-between border-t border-line bg-bg-soft px-4 py-2 text-[12px] text-muted">
            <span>↑↓ navega · ⏎ abre · esc fecha</span>
            <span>⌘K / Ctrl+K</span>
          </footer>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
