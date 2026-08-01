import Link from "next/link";
import { PlayCircle } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { cn } from "@/lib/cn";
import { getSessions } from "@/lib/admin/queries";

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function referrerHost(referrer: string | null) {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer;
  }
}

function formatRelative(date: Date) {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(diffSec, 0)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export default async function AdminSessionsPage() {
  const sessions = await getSessions(100);

  return (
    <>
      <PageHeader title="Sessions" description="Most recent 100 sessions" />

      <Table>
        <Thead>
          <Tr>
            <Th>Time</Th>
            <Th>When</Th>
            <Th>User</Th>
            <Th>IP</Th>
            <Th>Location</Th>
            <Th>Source</Th>
            <Th>Medium</Th>
            <Th>Campaign</Th>
            <Th className="text-right">Duration</Th>
            <Th>Bounce</Th>
            <Th>Replay</Th>
          </Tr>
        </Thead>
        <tbody>
          {sessions.length === 0 ? (
            <EmptyState />
          ) : (
            sessions.map((session) => (
              <Tr key={session.id}>
                <Td className="whitespace-nowrap">{session.startedAt.toLocaleString()}</Td>
                <Td className="whitespace-nowrap text-slate-500">{formatRelative(session.startedAt)}</Td>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-slate-700">
                      {session.visitor.fingerprint.slice(0, 8)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {session.visitor.deviceType ?? "—"} ·{" "}
                      <span className={session.visitor.isReturning ? "text-gold" : "text-slate-400"}>
                        {session.visitor.isReturning ? "Returning" : "New"}
                      </span>
                    </span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{session.ipAddress ?? "—"}</Td>
                <Td>
                  {[session.visitor.city, session.visitor.country].filter(Boolean).join(", ") || "—"}
                </Td>
                <Td>{session.utmSource ?? referrerHost(session.referrer)}</Td>
                <Td>{session.utmMedium ?? "—"}</Td>
                <Td>{session.utmCampaign ?? "—"}</Td>
                <Td className="text-right">{formatDuration(session.totalDuration)}</Td>
                <Td>
                  <span className={cn("font-medium", session.isBounce ? "text-red-500" : "text-emerald-600")}>
                    {session.isBounce ? "Yes" : "No"}
                  </span>
                </Td>
                <Td>
                  {session._count.replays > 0 ? (
                    <Link
                      href={`/admin/sessions/${session.id}/replay`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
                    >
                      <PlayCircle className="size-3.5" strokeWidth={2} />
                      Watch
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
