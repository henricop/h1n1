import { useEffect, useRef } from 'react';
import { JourneyRenderer } from '../../graphics/journey/JourneyRenderer';
import { journey, useJourney } from '../../journey/store';

export type CameraMove = { action: 'left' | 'right' | 'in' | 'out'; revision: number } | null;
const initialization = new WeakMap<HTMLCanvasElement, Promise<void>>();

export function JourneyCanvas({ cameraMove, resetCamera }: { cameraMove: CameraMove; resetCamera: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<JourneyRenderer | null>(null);
  useEffect(() => {
    let disposed = false;
    const element = canvas.current!;
    const previous = initialization.get(element) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      if (disposed) return;
      const instance = await JourneyRenderer.create(element, () => {
        const s = useJourney.getState();
        return { snapshot: s.snapshot, level: s.level, regionId: s.regionId, selectedCellSlot: s.selectedCellSlot, reducedMotion: s.reducedMotion, autoCamera: s.autoCamera, playing: journey.status === 'running', visualHour: journey.visualHour };
      }, {
        onAdvance: () => {}, // The shared app clock also drives the full anatomical atlas.
        onReady: (info) => { if (!disposed) useJourney.getState().setInfo(info); },
        onError: (error) => { if (!disposed) useJourney.getState().setError(error); },
        onSelectRegion: (id) => useJourney.getState().selectRegion(id),
        onSelectCell: (slot) => { useJourney.getState().selectCell(slot); useJourney.getState().navigate('cell'); },
        onNavigate: (level) => useJourney.getState().navigate(level),
      });
      if (disposed) { instance.dispose(); return; }
      renderer.current = instance;
      instance.start();
    });
    initialization.set(element, current);
    void current.catch((error: unknown) => { if (!disposed) useJourney.getState().setError(error instanceof Error ? error.message : 'Não foi possível iniciar o atlas 3D.'); });

    return () => { disposed = true; renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { if (cameraMove) renderer.current?.moveCamera(cameraMove.action); }, [cameraMove]);
  useEffect(() => { renderer.current?.resetCamera(); }, [resetCamera]);
  return <canvas ref={canvas} className="journey-canvas" aria-label="Atlas 3D interativo do corpo humano" />;
}
