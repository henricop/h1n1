'use client';
/**
 * Menu do shell (docs/reformulacao-v4.md §6 e §7): pílula com o TEXTO "Menu" (≥ 48 px) que abre um `<dialog>`
 * modal de tela inteira com os destinos em tipografia gigante e, embaixo, os institucionais em mono, a "Versão
 * simples (sem animação)" e o aviso clínico.
 *
 * - O `<dialog>` é IRMÃO do contêiner da página (`#page-root`, portal para o `<body>`), que recebe `inert = true`
 *   enquanto aberto. Ao fechar, `inert` sai ANTES de o foco voltar à pílula.
 * - `showModal()`; foco inicial no primeiro link; Tab/Shift+Tab presos com volta manual; Esc fecha (`cancel`).
 * - Rolagem travada: `getLenis()?.stop()` e `overflow: hidden` no `<html>` (cobre também a falta de Lenis);
 *   o painel rola por conta própria (`data-lenis-prevent`, `overscroll-behavior: contain`).
 * - Fecha na troca de `pathname` (e ao clicar no link da página atual).
 * - O conteúdo do menu fica em papel claro em qualquer tema (`PAPER_VARS`).
 * - Sem SSR do diálogo: no HTML do servidor só existe a pílula (nada de links duplicados escondidos).
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { getLenis } from '@/lib/motion/lenis';
import { isMotionReduced } from '@/lib/motion/prefs';
import { ClinicalNotice } from './ClinicalNotice';
import { SimpleModeToggle } from './SimpleModeToggle';
import { isCurrentPath, type ShellLink } from './links';
import { PAPER_VARS } from './paper';

export interface MenuProps {
  /** Destinos primários (já filtrados por elegibilidade e ordenados; ver `menuDestinations`). */
  destinations: readonly ShellLink[];
  /** Institucionais (`/sobre/*`, `/contato/`) com rótulo curto (ver `institutionalLinks`). */
  institutional: readonly ShellLink[];
  /** id do contêiner da página que fica `inert` com o menu aberto. */
  rootId?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

export function Menu({ destinations, institutional, rootId = 'page-root' }: MenuProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const animRef = useRef<gsap.Context | null>(null);
  const dialogId = `menu-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const unlock = useCallback(() => {
    const root = document.getElementById(rootId);
    if (root) root.inert = false;
    document.documentElement.style.removeProperty('overflow');
    getLenis()?.start();
  }, [rootId]);

  const closeMenu = useCallback(
    (opts: { focusPill?: boolean } = {}) => {
      if (!openRef.current) return;
      openRef.current = false;
      animRef.current?.revert();
      animRef.current = null;
      // 1) tira o inert ANTES de devolver o foco (a pílula está dentro de #page-root)
      unlock();
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      setOpen(false);
      if (opts.focusPill !== false) pillRef.current?.focus({ preventScroll: true });
    },
    [unlock],
  );

  const openMenu = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || openRef.current) return;
    openRef.current = true;
    // showModal antes do inert: o diálogo guarda a pílula como elemento a restaurar
    dialog.showModal();
    dialog.scrollTop = 0;
    const root = document.getElementById(rootId);
    if (root) root.inert = true;
    getLenis()?.stop();
    document.documentElement.style.overflow = 'hidden';
    setOpen(true);
    listRef.current?.querySelector<HTMLElement>('a[href]')?.focus({ preventScroll: true });
    if (!isMotionReduced()) {
      animRef.current = gsap.context(() => {
        // só opacidade/posição (nunca `visibility`: o primeiro link já está focado)
        gsap.from('[data-menu-item]', { yPercent: 35, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.035, clearProps: 'transform,opacity' });
      }, dialog);
    }
  }, [rootId]);

  // Fecha na troca de rota.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    closeMenu();
  }, [pathname, closeMenu]);

  // Desmontagem com o menu aberto (recarga a quente): nada fica travado.
  useEffect(
    () => () => {
      if (openRef.current) {
        openRef.current = false;
        animRef.current?.revert();
        unlock();
      }
    },
    [unlock],
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = focusables(dialog);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  // Link para a própria página não troca o pathname: fecha na hora.
  const onLinkClick = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (isCurrentPath(pathname, href)) closeMenu();
  };

  const dialog = (
    <dialog
      ref={dialogRef}
      id={dialogId}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      data-lenis-prevent=""
      onCancel={(e) => {
        e.preventDefault();
        closeMenu();
      }}
      onClose={() => closeMenu()}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-bg p-0 text-ink backdrop:bg-transparent"
      style={PAPER_VARS}
    >
      <div className="pointer-events-none sticky top-0 z-10 flex items-start justify-end pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[calc(env(safe-area-inset-right)+0.75rem)] md:pt-[calc(env(safe-area-inset-top)+1.25rem)] md:pr-[calc(env(safe-area-inset-right)+1.25rem)]">
        <button type="button" onClick={() => closeMenu()} className="pill pointer-events-auto" style={{ minHeight: '3rem' }}>
          Fechar
        </button>
      </div>

      <div className="mx-auto w-full max-w-[90rem] px-[calc(env(safe-area-inset-left)+1.25rem)] pt-4 pb-[calc(env(safe-area-inset-bottom)+3rem)] md:px-[calc(env(safe-area-inset-left)+2.5rem)] md:pt-6">
        <nav aria-label="Destinos">
          <ul ref={listRef} className="flex flex-col gap-1 md:gap-2">
            {destinations.map((d, i) => {
              const current = isCurrentPath(pathname, d.href);
              return (
                <li key={d.href} data-menu-item="">
                  <Link
                    href={d.href}
                    aria-current={current ? 'page' : undefined}
                    onClick={(e) => onLinkClick(e, d.href)}
                    className="display-lg group inline-flex items-baseline gap-3 py-1 no-underline decoration-2 underline-offset-[0.12em] hover:italic aria-[current=page]:underline md:gap-5"
                  >
                    <span aria-hidden="true" className="w-[4.5ch] shrink-0 font-sans text-[14px] not-italic tabular-nums text-muted md:text-[15px]">
                      ( {String(i + 1).padStart(2, '0')} )
                    </span>
                    <span>{d.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-12 grid gap-10 border-t border-line pt-8 md:mt-16 md:grid-cols-3" data-menu-item="">
          {institutional.length > 0 ? (
            <nav aria-label="Sobre o projeto">
              <p className="font-mono text-[14px] text-muted">Sobre o projeto</p>
              <ul className="mt-2">
                {institutional.map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={isCurrentPath(pathname, i.href) ? 'page' : undefined}
                      onClick={(e) => onLinkClick(e, i.href)}
                      className="inline-flex min-h-[44px] items-center font-mono text-[15px] text-ink no-underline hover:underline aria-[current=page]:underline"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <SimpleModeToggle />
          <ClinicalNotice compact className="text-[16px] leading-relaxed text-ink" />
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={openMenu}
        className="pill pointer-events-auto"
        style={{ minHeight: '3rem' }}
      >
        Menu
      </button>
      {mounted ? createPortal(dialog, document.body) : null}
    </>
  );
}
