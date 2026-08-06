"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { ReplayPlayer } from "@/components/admin/ReplayPlayer";
import { cn } from "@/lib/cn";
import type { SessionRow } from "@/lib/admin/queries";

type TimelineEntry = { at: string; label: string };

type ReplayData = {
  events: unknown[];
  timeline: TimelineEntry[];
};

function formatElapsed(startedAt: number, at: string) {
  const seconds = Math.max(0, Math.round((new Date(at).getTime() - startedAt) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionReplayModal({ session, onClose }: { session: SessionRow; onClose: () => void }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/sessions/${session.id}/replay`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load replay");
        return res.json();
      })
      .then((json: ReplayData) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [session.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const startedAt = session.startedAt.getTime();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-replay-title"
        className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="session-replay-title" className="text-sm font-semibold text-slate-800">
                Session replay
              </h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  session.isReturning ? "bg-gold/10 text-gold" : "bg-emerald-50 text-emerald-600",
                )}
              >
                {session.isReturning ? "Returning" : "New"}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{session.fingerprint.slice(0, 12)}</p>
            <p className="mt-1 text-xs text-slate-400">
              {[session.city, session.country].filter(Boolean).join(", ") || "Unknown location"} ·{" "}
              {session.deviceType ?? "Unknown device"} · {session.browser ?? "Unknown browser"} ·{" "}
              {session.os ?? "Unknown OS"} · {session.screenWidth && session.screenHeight
                ? `${session.screenWidth}×${session.screenHeight}`
                : "—"}{" "}
              · {session.startedAt.toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>

        <div className="grid gap-4 px-5 py-4 md:grid-cols-[2fr_1fr]">
          <div className="min-w-0">
            {error ? (
              <div className="grid h-40 place-items-center rounded-xl border border-slate-200 text-sm text-slate-400">
                Couldn&apos;t load this replay.
              </div>
            ) : !data ? (
              <div className="grid h-40 place-items-center rounded-xl border border-slate-200">
                <Loader2 className="size-5 animate-spin text-slate-300" strokeWidth={2} />
              </div>
            ) : (
              <ReplayPlayer events={data.events} />
            )}
          </div>

          <div className="flex flex-col">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Event log{data ? ` (${data.timeline.length})` : ""}
            </h3>
            <div className="flex max-h-[520px] flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2">
              {!data ? (
                <div className="grid h-20 place-items-center">
                  <Loader2 className="size-4 animate-spin text-slate-300" strokeWidth={2} />
                </div>
              ) : data.timeline.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-slate-400">No events recorded.</p>
              ) : (
                data.timeline.map((entry, index) => (
                  <div
                    key={`${entry.at}-${index}`}
                    className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {formatElapsed(startedAt, entry.at)}
                    </span>
                    <span className="truncate text-slate-700" title={entry.label}>
                      {entry.label}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
