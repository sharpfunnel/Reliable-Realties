"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 20000;

export function LiveBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/live", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { count?: number };
        if (typeof data.count === "number" && !cancelled) setCount(data.count);
      } catch {
        // transient network hiccup — keep showing the last known count
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
      </span>
      {count.toLocaleString()} live
    </span>
  );
}
