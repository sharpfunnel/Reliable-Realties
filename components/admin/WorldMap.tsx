import { COUNTRY_POINTS } from "@/lib/admin/geo";
import { WORLD_COUNTRY_PATHS } from "@/lib/admin/worldMapPaths";

export function WorldMap({ data }: { data: { country: string; visitors: number; leads: number }[] }) {
  const byCode = new Map(data.map((d) => [d.country, d]));
  const maxVisitors = Math.max(1, ...data.map((d) => d.visitors));

  return (
    <svg viewBox="0 0 1000 500" className="w-full">
      {WORLD_COUNTRY_PATHS.map((country) => (
        <path key={country.id} d={country.d} fill="#eef2f7" stroke="#dbe3ec" strokeWidth={0.75} />
      ))}
      {Object.entries(COUNTRY_POINTS).map(([code, point]) => {
        const row = byCode.get(code);
        if (!row || row.visitors === 0) return null;
        const radius = 4 + Math.sqrt(row.visitors / maxVisitors) * 12;
        return (
          <circle
            key={code}
            cx={point.x}
            cy={point.y}
            r={radius}
            fill="#b68a5e"
            fillOpacity={0.75}
            stroke="#b68a5e"
            strokeWidth={1}
          >
            <title>
              {point.name}: {row.visitors.toLocaleString()} visitor{row.visitors === 1 ? "" : "s"}
              {row.leads > 0 ? `, ${row.leads} lead${row.leads === 1 ? "" : "s"}` : ""}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
