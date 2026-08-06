export function BarList({
  items,
  color = "#b68a5e",
  emptyMessage = "No data yet.",
}: {
  items: { label: string; value: number }[];
  color?: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <div className="grid h-30 place-items-center text-sm text-slate-400">{emptyMessage}</div>;
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-600" title={item.label}>
            {item.label}
          </span>
          <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
            <div
              className="h-full rounded-md transition-all"
              style={{ width: `${Math.max((item.value / max) * 100, 3)}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-800">
            {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
