'use client';
/**
 * Controle "Versão simples (sem animação)": switch acessível (`role="switch"` + `aria-checked`) persistido no
 * localStorage por `setSimpleMode` (desliga Lenis, interpolação de tema, scrub, contagem, deriva, 3D e grão; cada
 * frente consulta `isSimpleMode()` / `onSimpleMode()`). Estado lido do `<html data-simple>` (aplicado antes da
 * pintura pelo script do layout); no servidor, desligado.
 */
import { useId, useSyncExternalStore } from 'react';
import { isSimpleMode, onSimpleMode, setSimpleMode } from '@/lib/motion/simple-mode';

const subscribe = (cb: () => void) => onSimpleMode(() => cb());
const serverSnapshot = () => false;

export function SimpleModeToggle({ className = '' }: { className?: string }) {
  const on = useSyncExternalStore(subscribe, isSimpleMode, serverSnapshot);
  const hintId = useId();
  return (
    <div className={className}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={hintId}
        onClick={() => setSimpleMode(!on)}
        className="group inline-flex min-h-[48px] items-center gap-3 rounded-full py-1 pr-2 text-left text-[16px] font-medium text-ink"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors motion-reduce:transition-none ${
            on ? 'border-ink bg-ink' : 'border-line-strong bg-card'
          }`}
        >
          <span
            className={`absolute left-0.5 h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${on ? 'translate-x-5 bg-card' : 'translate-x-0 bg-ink'}`}
          />
        </span>
        <span>Versão simples (sem animação)</span>
      </button>
      <p id={hintId} className="mt-1 text-[14px] leading-snug text-muted">
        Desliga a rolagem suave, as animações e o 3D (mostra imagens fixas). Fica salvo neste navegador.
      </p>
    </div>
  );
}
