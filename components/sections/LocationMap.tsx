import { cn } from "@/lib/cn";
import { location, site } from "@/lib/content";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/LogoMark";

/**
 * Stylised locality map.
 *
 * Drawn as inline SVG rather than shipped as an image so it carries Reliable
 * Realties' own branding, stays crisp at any size, and costs no extra request.
 * Pin positions come from `location.mapPins` and are expressed as percentages
 * of the map viewport, so the layout holds at every breakpoint.
 */
export function LocationMap({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Map of ${site.project} in Nerul MIDC, Navi Mumbai, showing nearby landmarks and drive times`}
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-[#f1eee6] ring-1 ring-inset ring-ink/5",
        className,
      )}
    >
      {/* Terrain, water and road network */}
      <svg
        viewBox="0 0 732 520"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        className="absolute inset-0 size-full"
      >
        {/* Green belts */}
        <g fill="#e4e8dc">
          <ellipse cx="120" cy="120" rx="150" ry="95" />
          <ellipse cx="600" cy="150" rx="130" ry="80" />
          <ellipse cx="250" cy="430" rx="160" ry="90" />
        </g>
        {/* Creek / water */}
        <g fill="#dfe7ea">
          <path d="M732 300c-60 6-110 30-150 66-34 30-70 48-112 54h262V300Z" />
          <ellipse cx="662" cy="86" rx="70" ry="34" />
        </g>

        {/* Minor roads */}
        <g stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round">
          <path d="M0 190C120 176 210 214 300 250s180 60 300 34" />
          <path d="M96 0c26 120 8 220-40 330" />
          <path d="M470 0c-20 130 6 240 66 360" />
          <path d="M732 214c-120 10-200 54-268 128" />
          <path d="M180 520c40-90 118-150 228-176" />
        </g>

        {/* Arterial roads */}
        <g stroke="#ffffff" strokeWidth="13" fill="none" strokeLinecap="round">
          <path d="M0 96c150 40 260 96 330 168 62 64 150 106 402 118" />
          <path d="M256 0c-8 150 22 268 92 372" />
        </g>
        <g
          stroke="#e9dcc6"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="1 14"
        >
          <path d="M0 96c150 40 260 96 330 168 62 64 150 106 402 118" />
        </g>
      </svg>

      {/* Landmark pins. The icon is always centred on its coordinate; the
          label floats beside it (inward, so it never clips the edge) and is
          taken out of flow so it can never push the icon off-canvas. */}
      {location.mapPins.map((pin) => {
        const labelLeft = pin.x >= 55;
        return (
          <div
            key={pin.label}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            <span className="grid size-8 place-items-center rounded-full bg-white/80 ring-1 ring-inset ring-gold/25 sm:size-9">
              <Icon
                name={pin.icon as IconName}
                className="size-4 text-gold"
                strokeWidth={1.4}
              />
            </span>
            {/* Hidden on narrow viewports, where labels would collide — the
                drive-time strip below the map carries the same information. */}
            <span
              className={cn(
                "absolute top-1/2 hidden -translate-y-1/2 flex-col leading-tight md:flex",
                labelLeft
                  ? "right-full mr-2 items-end text-right"
                  : "left-full ml-2",
              )}
            >
              <span className="whitespace-nowrap text-[11px] font-medium text-ink">
                {pin.label}
              </span>
              <span className="whitespace-nowrap text-[10px] text-ink-soft">
                {pin.time}
              </span>
            </span>
          </div>
        );
      })}

      {/* Project marker */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <span className="grid size-14 place-items-center rounded-full rounded-bl-none bg-white shadow-[0_10px_30px_-12px_rgba(18,24,32,0.45)] ring-1 ring-inset ring-gold/30 sm:size-16">
          <LogoMark className="size-8 sm:size-9" />
        </span>
        <span className="mt-2 text-center font-display text-sm uppercase leading-tight tracking-[0.06em] text-ink sm:text-base">
          {site.name}
        </span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-gold sm:text-[10px]">
          {site.project}
        </span>
      </div>
    </div>
  );
}
