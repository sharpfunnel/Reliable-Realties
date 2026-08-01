"use client";

import { useEffect, useRef } from "react";
import "rrweb-player/dist/style.css";

export function ReplayPlayer({ events }: { events: unknown[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || events.length === 0) return;
    let destroyed = false;
    let playerInstance: { $destroy?: () => void } | null = null;

    import("rrweb-player").then(({ default: Player }) => {
      if (destroyed || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      playerInstance = new Player({
        target: containerRef.current,
        props: {
          events: events as never,
          width: containerRef.current.clientWidth,
          height: 640,
          showController: true,
          autoPlay: false,
        },
      }) as unknown as { $destroy?: () => void };
    });

    return () => {
      destroyed = true;
      playerInstance?.$destroy?.();
    };
  }, [events]);

  if (events.length === 0) {
    return <div className="grid h-40 place-items-center text-sm text-slate-400">No replay data recorded.</div>;
  }

  return <div ref={containerRef} className="overflow-hidden rounded-xl border border-slate-200 bg-white" />;
}
