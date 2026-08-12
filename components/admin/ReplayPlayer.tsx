"use client";

import { useEffect, useRef } from "react";
import "rrweb-player/dist/style.css";

// rrweb's EventType.FullSnapshot — without one, the player has no base DOM to
// apply incremental diffs onto and silently renders a blank page.
const FULL_SNAPSHOT = 2;

export function ReplayPlayer({ events }: { events: unknown[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFullSnapshot = events.some((event) => (event as { type?: number }).type === FULL_SNAPSHOT);

  useEffect(() => {
    if (!containerRef.current || events.length === 0 || !hasFullSnapshot) return;
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
  }, [events, hasFullSnapshot]);

  if (events.length === 0) {
    return <div className="grid h-40 place-items-center text-sm text-slate-400">No replay data recorded.</div>;
  }

  if (!hasFullSnapshot) {
    return (
      <div className="grid h-40 place-items-center px-4 text-center text-sm text-slate-400">
        This recording is missing its initial snapshot and can&apos;t be played back.
      </div>
    );
  }

  return <div ref={containerRef} className="overflow-hidden rounded-xl border border-slate-200 bg-white" />;
}
