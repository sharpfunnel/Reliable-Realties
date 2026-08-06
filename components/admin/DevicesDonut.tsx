const COLORS: Record<string, string> = {
  desktop: "#3b82f6",
  mobile: "#f97316",
  tablet: "#a855f7",
};
const DEFAULT_COLOR = "#94a3b8";

function colorFor(type: string) {
  return COLORS[type.toLowerCase()] ?? DEFAULT_COLOR;
}

function displayLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function DevicesDonut({ data }: { data: { type: string; count: number; pct: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <div className="grid h-40 place-items-center text-sm text-slate-400">No data yet.</div>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const segments = data.reduce<{ type: string; dash: number; offset: number }[]>((acc, d) => {
    const dash = (d.pct / 100) * circumference;
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    return [...acc, { type: d.type, dash, offset }];
  }, []);

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="size-36 shrink-0">
        <circle cx={80} cy={80} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={20} />
        <g transform="rotate(-90 80 80)">
          {segments.map((s) => (
            <circle
              key={s.type}
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke={colorFor(s.type)}
              strokeWidth={20}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <text x={80} y={76} textAnchor="middle" fill="#0f172a" fontSize={26} fontWeight={600}>
          {total}
        </text>
        <text x={80} y={96} textAnchor="middle" fill="#94a3b8" fontSize={11}>
          Sessions
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.type} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: colorFor(d.type) }} />
            <span className="font-medium text-slate-700">{displayLabel(d.type)}</span>
            <span className="text-slate-400">
              {d.count.toLocaleString()} · {d.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
