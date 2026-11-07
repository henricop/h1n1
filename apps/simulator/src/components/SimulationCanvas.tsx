import { useEffect, useRef } from 'react';
import { MicroscopeRenderer } from '../graphics/Renderer';
import { simulation, useSimulator } from '../store';

// Serialize async initialization per canvas, including React's dev StrictMode remount.
// Disposing an older WebGPU context must finish before a replacement uses the same canvas.
const initializations = new WeakMap<HTMLCanvasElement, Promise<void>>();

export function SimulationCanvas({ cameraReset, cameraMove }: { cameraReset: number; cameraMove: { action: 'left' | 'right' | 'in' | 'out'; revision: number } | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<MicroscopeRenderer | null>(null);
  const selectedCell = useSimulator((s) => s.selectedCell);
  const autoCamera = useSimulator((s) => s.autoCamera);
  const reducedMotion = useSimulator((s) => s.reducedMotion);
  useEffect(() => {
    let disposed = false;
    const element = canvas.current!;
    const previous = initializations.get(element) ?? Promise.resolve();
    const initialization = previous.catch(() => {}).then(async () => {
      if (disposed) return;
      const instance = await MicroscopeRenderer.create(element, simulation, {
      onSelect: (id) => useSimulator.getState().selectCell(id),
      onReady: (info) => { if (!disposed) useSimulator.getState().setRendererInfo(info); },
      onError: (message) => { if (!disposed) useSimulator.getState().setError(message); },
      });
      if (disposed) { instance.dispose(); return; }
      renderer.current = instance;
      instance.setReducedMotion(useSimulator.getState().reducedMotion);
      instance.setAutoCamera(useSimulator.getState().autoCamera);
      instance.start();
    });
    initializations.set(element, initialization);
    void initialization.catch((error: unknown) => {
      if (!disposed) useSimulator.getState().setError(error instanceof Error ? error.message : 'Não foi possível iniciar a cena 3D.');
    });
    const publish = window.setInterval(() => useSimulator.getState().publish(), 125);
    return () => { disposed = true; clearInterval(publish); renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setAutoCamera(autoCamera); }, [autoCamera]);
  useEffect(() => { renderer.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);
  useEffect(() => { if (selectedCell !== null) renderer.current?.focusCell(selectedCell); else renderer.current?.clearSelection(); }, [selectedCell]);
  useEffect(() => { renderer.current?.resetCamera(); }, [cameraReset]);
  useEffect(() => { if (cameraMove) renderer.current?.moveCamera(cameraMove.action); }, [cameraMove]);
  return <canvas ref={canvas} className="simulation-canvas" aria-label="Ambiente microscópico 3D interativo" />;
}
