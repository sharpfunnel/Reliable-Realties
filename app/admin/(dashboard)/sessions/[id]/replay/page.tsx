import { gunzipSync } from "node:zlib";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { ReplayPlayer } from "@/components/admin/ReplayPlayer";
import { getSessionReplayChunks, getSessionReplayMeta } from "@/lib/admin/queries";

export default async function AdminSessionReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, chunks] = await Promise.all([getSessionReplayMeta(id), getSessionReplayChunks(id)]);
  if (!session) notFound();

  const events = chunks.flatMap((chunk) => {
    try {
      const json = gunzipSync(Buffer.from(chunk.data)).toString("utf-8");
      return JSON.parse(json) as unknown[];
    } catch {
      return [];
    }
  });

  return (
    <>
      <Link
        href="/admin/sessions"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Back to sessions
      </Link>

      <PageHeader
        title="Session replay"
        description={`${session.visitor.fingerprint.slice(0, 10)} · started ${session.startedAt.toLocaleString()}`}
      />
      <ReplayPlayer events={events} />
    </>
  );
}
