import { countryName, flagEmoji } from "@/lib/admin/geo";

export function CountryList({
  data,
  limit = 10,
}: {
  data: { country: string; visitors: number; leads: number }[];
  limit?: number;
}) {
  if (data.length === 0) {
    return <div className="grid h-30 place-items-center text-sm text-slate-400">No data yet.</div>;
  }

  const max = Math.max(1, ...data.map((d) => d.visitors));
  const rows = data.slice(0, limit);
  const rest = data.slice(limit);
  const restVisitors = rest.reduce((sum, d) => sum + d.visitors, 0);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.country} className="flex items-center gap-2.5 text-xs">
          <span className="text-base leading-none">{row.country === "Unknown" ? "🏳️" : flagEmoji(row.country)}</span>
          <span className="w-28 shrink-0 truncate font-medium text-slate-700">
            {row.country === "Unknown" ? "Unknown" : countryName(row.country)}
          </span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gold/70"
              style={{ width: `${Math.max((row.visitors / max) * 100, 4)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-semibold text-slate-800">{row.visitors}</span>
          {row.leads > 0 ? (
            <span className="w-14 shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-center text-[10px] font-semibold text-emerald-600">
              {row.leads} lead{row.leads === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="w-14 shrink-0" />
          )}
        </div>
      ))}
      {rest.length > 0 ? (
        <div className="pt-1 text-[11px] text-slate-400">
          +{rest.length} more location{rest.length === 1 ? "" : "s"} ({restVisitors} visitor{restVisitors === 1 ? "" : "s"})
        </div>
      ) : null}
    </div>
  );
}
