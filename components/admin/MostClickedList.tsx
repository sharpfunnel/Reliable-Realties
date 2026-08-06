type Item = { selector: string; label: string; count: number; visitors: number };

export function MostClickedList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <div className="grid h-40 place-items-center text-sm text-slate-500">No data yet.</div>;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li
          key={item.selector}
          className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/60 px-3 py-2"
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-900">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-100" title={item.label}>
              {item.label}
            </div>
            <div className="text-[11px] text-slate-500">
              {item.visitors} {item.visitors === 1 ? "person" : "people"}
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">
            {item.count}
          </span>
        </li>
      ))}
    </ol>
  );
}
