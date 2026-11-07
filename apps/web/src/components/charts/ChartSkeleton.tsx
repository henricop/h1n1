/** Reserva a altura do gráfico enquanto o ECharts carrega (sem layout shift), sobre o papel. */
export function ChartSkeleton({ height, label = 'Carregando gráfico…' }: { height: number; label?: string }) {
  return (
    <div className="relative flex items-center justify-center rounded-2xl border border-line bg-bg-soft" style={{ height }} role="status" aria-live="polite">
      <p className="font-mono text-[14px] text-muted">{label}</p>
    </div>
  );
}
