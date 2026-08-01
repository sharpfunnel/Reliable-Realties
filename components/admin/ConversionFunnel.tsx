export function ConversionFunnel({
  stages,
}: {
  stages: { key: string; label: string; count: number }[];
}) {
  const start = stages[0]?.count || 1;

  return (
    <div className="flex flex-col gap-2">
      {stages.map((stage, index) => {
        const pctOfStart = start > 0 ? (stage.count / start) * 100 : 0;
        const prev = stages[index - 1];
        const dropOff = prev && prev.count > 0 ? ((prev.count - stage.count) / prev.count) * 100 : 0;

        return (
          <div key={stage.key} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs font-medium text-slate-600">{stage.label}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
              <div
                className="h-full rounded-md bg-gold/80 transition-all"
                style={{ width: `${Math.max(pctOfStart, 2)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-800">
              {stage.count.toLocaleString()}
            </span>
            <span className="w-14 shrink-0 text-right text-xs text-slate-400">{pctOfStart.toFixed(0)}%</span>
            {index > 0 ? (
              <span className="w-20 shrink-0 text-right text-xs text-red-400">
                {dropOff > 0 ? `−${dropOff.toFixed(0)}%` : "—"}
              </span>
            ) : (
              <span className="w-20 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
