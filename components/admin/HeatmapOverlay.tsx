"use client";

import { useEffect, useRef, useState } from "react";

export function HeatmapOverlay({
  path,
  points,
}: {
  path: string;
  points: { xPct: number; yPct: number }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative h-[720px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <iframe src={path} title="Heatmap target page" className="h-full w-full border-0" />
      <div className="pointer-events-none absolute inset-0">
        {size.width > 0 &&
          points.map((point, i) => (
            <span
              key={i}
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/40 mix-blend-multiply"
              style={{
                left: `${point.xPct}%`,
                top: `${point.yPct}%`,
              }}
            />
          ))}
      </div>
    </div>
  );
}
