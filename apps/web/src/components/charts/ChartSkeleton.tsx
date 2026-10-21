/** Reserva a altura do gráfico enquanto o ECharts carrega (sem layout shift). */
export function ChartSkeleton({ height, label = 'Carregando gráfico…' }: { height: number; label?: string }) {
  return (
    <div className="scanlines relative flex items-center justify-center rounded border border-line bg-bg-950/60" style={{ height }} role="status" aria-live="polite">
      <p className="font-mono text-xs text-faint">{label}</p>
    </div>
  );
}
