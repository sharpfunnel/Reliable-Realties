"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, Download, PlayCircle, RotateCcw, Search, Send } from "lucide-react";

import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { SessionReplayModal } from "@/components/admin/SessionReplayModal";
import {
  SendSessionCapiBulkDialog,
  SendSessionCapiModal,
  type SendSessionCapiSession,
} from "@/components/admin/SendSessionCapiModal";
import { qualityGrade } from "@/lib/meta/capi-constants";
import { cn } from "@/lib/cn";
import type { SessionRow } from "@/lib/admin/queries";

const RANGE_OPTIONS = [
  { value: "1", label: "Last 24 Hours" },
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

const VISITOR_TYPE_OPTIONS = [
  { value: "all", label: "All visitors" },
  { value: "new", label: "New visitors" },
  { value: "returning", label: "Returning visitors" },
];

export type SessionsFilterValues = {
  range: string;
  visitorType: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  source: string;
  q: string;
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

function StatusBadge({ status }: { status: SessionRow["status"] }) {
  const styles: Record<SessionRow["status"], string> = {
    active: "bg-emerald-50 text-emerald-600",
    bounced: "bg-red-50 text-red-500",
    completed: "bg-slate-100 text-slate-600",
  };
  const labels: Record<SessionRow["status"], string> = {
    active: "Active",
    bounced: "Bounced",
    completed: "Completed",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", styles[status])}>
      {labels[status]}
    </span>
  );
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={cn("text-xs font-medium", value ? "text-emerald-600" : "text-slate-300")}>
      {value ? "Yes" : "No"}
    </span>
  );
}

const QUALITY_BADGE: Record<string, string> = {
  hot: "bg-red-50 text-red-600",
  warm: "bg-amber-50 text-amber-700",
  cold: "bg-sky-50 text-sky-600",
};

function QualityBadge({ quality }: { quality: string | null }) {
  const grade = qualityGrade(quality);
  if (!grade) return <span className="text-xs text-slate-300">—</span>;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", QUALITY_BADGE[grade.value])}>
      {grade.label}
    </span>
  );
}

/** The row's CAPI delivery state, mirroring the leads table's Sent/Failed badge. */
function CapiStatus({ session }: { session: SessionRow }) {
  if (session.metaCapiError) {
    return (
      <span className="text-[11px] font-medium text-red-500" title={session.metaCapiError}>
        Failed
      </span>
    );
  }
  if (session.metaCapiSentAt) {
    return (
      <span
        className="text-[11px] font-medium text-emerald-600"
        title={`${session.metaCapiEvent ?? "Event"} sent ${formatRelative(session.metaCapiSentAt)}`}
      >
        Sent
      </span>
    );
  }
  return null;
}

/** Narrows a table row to the display fields the grading modal needs. */
function toSendSession(session: SessionRow): SendSessionCapiSession {
  return {
    id: session.id,
    city: session.city,
    country: session.country,
    trafficSource: session.trafficSource,
    totalDuration: session.totalDuration,
    pagesViewed: session.pagesViewed,
    maxScrollPct: session.maxScrollPct,
    ctaClicked: session.ctaClicked,
    formStarted: session.formStarted,
    formSubmitted: session.formSubmitted,
    capiIdentifiers: session.capiIdentifiers,
    capiSendable: session.capiSendable,
    metaCapiQuality: session.metaCapiQuality,
  };
}

type Column = {
  key: string;
  label: string;
  /** Always rendered and kept out of the Columns menu — the row's own affordance. */
  pinned?: boolean;
  /** Available in the Columns menu but off until asked for — sparse or debug-ish data. */
  defaultHidden?: boolean;
  /** Applied to both the header and the cells, so the two stay aligned. */
  align?: "center" | "right";
  className?: string;
  /** Set on cells holding their own controls, so clicking one doesn't open the replay. */
  stopRowClick?: boolean;
  title?: (session: SessionRow) => string | undefined;
  render: (session: SessionRow) => ReactNode;
};

/**
 * The table is driven by this one ordered list, so header and cells can't drift
 * apart and reordering a column is a single move. Order reflects how the table
 * is read: when the visit happened and which campaign it came from first, the
 * technical context after, and the opaque IDs last.
 */
const COLUMNS: Column[] = [
  {
    key: "replay",
    label: "Replay",
    pinned: true,
    render: (session) =>
      session.hasReplay ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gold">
          <PlayCircle className="size-3.5" strokeWidth={2} />
          Watch
        </span>
      ) : (
        <span className="text-xs text-slate-300">—</span>
      ),
  },
  {
    key: "capi",
    label: "Meta CAPI",
    pinned: true,
    stopRowClick: true,
    className: "whitespace-nowrap",
    render: (session) => (
      <span className="flex items-center gap-1.5">
        <CapiStatus session={session} />
        <SendSessionCapiModal session={toSendSession(session)} />
      </span>
    ),
  },
  {
    key: "quality",
    label: "Quality",
    render: (session) => <QualityBadge quality={session.metaCapiQuality} />,
  },
  { key: "status", label: "Status", render: (session) => <StatusBadge status={session.status} /> },
  { key: "date", label: "Date", className: "whitespace-nowrap", render: (session) => formatDate(session.startedAt) },
  { key: "time", label: "Time", className: "whitespace-nowrap", render: (session) => formatTime(session.startedAt) },
  {
    key: "timeAgo",
    label: "Time Ago",
    className: "whitespace-nowrap text-slate-500",
    render: (session) => formatRelative(session.startedAt),
  },

  // Campaign block — the acquisition story, up front.
  {
    key: "campaign",
    label: "Campaign",
    className: "max-w-64 truncate",
    title: (session) => session.utmCampaign ?? undefined,
    render: (session) => session.utmCampaign ?? "—",
  },
  { key: "source", label: "Traffic Source", className: "whitespace-nowrap", render: (session) => session.trafficSource },
  { key: "utmSource", label: "UTM Source", render: (session) => session.utmSource ?? "—" },
  { key: "utmMedium", label: "UTM Medium", render: (session) => session.utmMedium ?? "—" },
  {
    key: "utmContent",
    label: "UTM Content",
    className: "max-w-48 truncate",
    title: (session) => session.utmContent ?? undefined,
    render: (session) => session.utmContent ?? "—",
  },
  {
    key: "utmTerm",
    label: "UTM Term",
    defaultHidden: true,
    className: "max-w-48 truncate",
    title: (session) => session.utmTerm ?? undefined,
    render: (session) => session.utmTerm ?? "—",
  },
  { key: "placement", label: "Placement", render: (session) => session.placement ?? "—" },
  {
    key: "metaCampaignId",
    label: "Meta Campaign ID",
    defaultHidden: true,
    className: "font-mono text-xs text-slate-500",
    render: (session) => session.metaCampaignId ?? "—",
  },
  {
    key: "metaAdsetId",
    label: "Meta Ad Set ID",
    defaultHidden: true,
    className: "font-mono text-xs text-slate-500",
    render: (session) => session.metaAdsetId ?? "—",
  },
  {
    key: "metaAdId",
    label: "Meta Ad ID",
    defaultHidden: true,
    className: "font-mono text-xs text-slate-500",
    render: (session) => session.metaAdId ?? "—",
  },
  { key: "clickIds", label: "Click IDs", defaultHidden: true, render: (session) => session.clickIds ?? "—" },
  {
    key: "rawParams",
    label: "URL Params",
    defaultHidden: true,
    className: "whitespace-nowrap text-slate-500",
    title: (session) => session.rawParams?.full,
    render: (session) => session.rawParams?.preview ?? "—",
  },
  {
    key: "referrer",
    label: "Referrer",
    className: "max-w-40 truncate",
    title: (session) => session.referrer ?? undefined,
    render: (session) => session.referrer ?? "Direct",
  },

  // What they did on the site.
  {
    key: "visitorType",
    label: "Visitor Type",
    render: (session) => (
      <span className={session.isReturning ? "text-gold" : "text-slate-500"}>
        {session.isReturning ? "Returning" : "New"}
      </span>
    ),
  },
  {
    key: "landingPage",
    label: "Landing Page",
    className: "max-w-32 truncate font-mono text-xs",
    title: (session) => session.entryPath ?? undefined,
    render: (session) => session.entryPath ?? "—",
  },
  {
    key: "currentPage",
    label: "Current Page",
    className: "max-w-32 truncate font-mono text-xs",
    title: (session) => session.currentPath ?? undefined,
    render: (session) => session.currentPath ?? "—",
  },
  { key: "pagesViewed", label: "Pages Viewed", align: "center", render: (session) => session.pagesViewed },
  { key: "duration", label: "Duration", align: "right", render: (session) => formatDuration(session.totalDuration) },
  { key: "formStarted", label: "Form Started", render: (session) => <YesNo value={session.formStarted} /> },
  { key: "formSubmitted", label: "Form Submitted", render: (session) => <YesNo value={session.formSubmitted} /> },
  { key: "ctaClicked", label: "CTA Clicked", render: (session) => <YesNo value={session.ctaClicked} /> },
  {
    key: "bounce",
    label: "Bounce",
    render: (session) => (
      <span className={cn("font-medium", session.isBounce ? "text-red-500" : "text-emerald-600")}>
        {session.isBounce ? "Yes" : "No"}
      </span>
    ),
  },
  { key: "avgScroll", label: "Avg Scroll %", render: (session) => `${session.avgScrollPct}%` },
  { key: "maxScroll", label: "Max Scroll %", render: (session) => `${session.maxScrollPct}%` },
  { key: "mouseClicks", label: "Mouse Clicks", align: "center", render: (session) => session.mouseClicks },
  { key: "mouseMoves", label: "Mouse Movements", align: "center", render: (session) => session.mouseMovements },

  // Where and on what.
  { key: "country", label: "Country", render: (session) => session.country ?? "—" },
  { key: "city", label: "City", render: (session) => session.city ?? "—" },
  { key: "region", label: "Region", render: (session) => session.region ?? "—" },
  { key: "timezone", label: "Timezone", className: "whitespace-nowrap", render: (session) => session.timezone ?? "—" },
  { key: "device", label: "Device", className: "capitalize", render: (session) => session.deviceType ?? "—" },
  { key: "os", label: "Operating System", render: (session) => session.os ?? "—" },
  { key: "browser", label: "Browser", render: (session) => session.browser ?? "—" },
  {
    key: "screen",
    label: "Screen Resolution",
    className: "whitespace-nowrap",
    render: (session) =>
      session.screenWidth && session.screenHeight ? `${session.screenWidth}×${session.screenHeight}` : "—",
  },
  { key: "language", label: "Language", render: (session) => session.language ?? "—" },
  { key: "network", label: "Network", render: (session) => (session.network ? session.network.toUpperCase() : "—") },
  { key: "ip", label: "IP Address", className: "whitespace-nowrap", render: (session) => session.ipAddress ?? "—" },

  // Identifiers — needed for support lookups, never for scanning the table.
  {
    key: "sessionId",
    label: "Session ID",
    className: "font-mono text-xs text-slate-500",
    title: (session) => session.id,
    render: (session) => `s_${session.id.slice(0, 12)}`,
  },
  {
    key: "visitorId",
    label: "Visitor ID",
    className: "font-mono text-xs text-slate-500",
    title: (session) => session.visitorId,
    render: (session) => `v_${session.fingerprint.slice(0, 12)}`,
  },
  {
    key: "capiIdentifiers",
    label: "Meta Match",
    defaultHidden: true,
    className: "text-xs text-slate-500",
    title: (session) =>
      session.capiSendable
        ? undefined
        : "Meta has no way to identify this visitor, so a conversion event would be discarded.",
    render: (session) =>
      session.capiIdentifiers.length > 0 ? (
        session.capiIdentifiers.join(", ")
      ) : (
        <span className="text-slate-300">none</span>
      ),
  },
];

const ALIGN_CLASS = { left: "", center: "text-center", right: "text-right" } as const;

const TOGGLEABLE_COLUMNS = COLUMNS.filter((column) => !column.pinned);

const DEFAULT_VISIBLE: Record<string, boolean> = Object.fromEntries(
  TOGGLEABLE_COLUMNS.map((column) => [column.key, !column.defaultHidden]),
);

export function SessionsWorkspace({
  rows,
  filters,
  filterOptions,
}: {
  rows: SessionRow[];
  filters: SessionsFilterValues;
  filterOptions: { countries: string[]; cities: string[]; devices: string[]; browsers: string[]; systems: string[]; sources: string[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all" || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      startTransition(() => {
        router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  const reset = useCallback(() => {
    startTransition(() => router.push(pathname));
  }, [pathname, router]);

  const [searchInput, setSearchInput] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setSearchInput(filters.q);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.q) setParams({ q: searchInput || null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const toggleColumn = (key: string) => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  const shownColumns = COLUMNS.filter((column) => column.pinned || visibleColumns[column.key]);

  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // The `?session=` URL param makes the open replay shareable/deep-linkable,
  // but this route has no Suspense boundaries, so a router navigation only
  // repaints once the page's server queries finish. Mirroring it into local
  // state lets the modal open/close instantly while the URL catches up in
  // the background — the DB round-trip no longer blocks the click.
  const activeSessionId = searchParams.get("session");
  const [openSessionId, setOpenSessionId] = useState(activeSessionId);
  const [syncedSessionId, setSyncedSessionId] = useState(activeSessionId);
  if (activeSessionId !== syncedSessionId) {
    setSyncedSessionId(activeSessionId);
    setOpenSessionId(activeSessionId);
  }

  const activeSession = openSessionId
    ? (rows.find((row) => row.id === openSessionId && row.hasReplay) ?? null)
    : null;

  const openReplay = useCallback(
    (session: SessionRow) => {
      if (!session.hasReplay) return;
      setOpenSessionId(session.id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("session", session.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const closeReplay = useCallback(() => {
    setOpenSessionId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("session");
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // Selection is derived against `rows`, never held independently, so changing a
  // filter can't leave sessions selected that the operator can no longer see —
  // and therefore can't send.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const sendableRows = rows.filter((row) => row.capiSendable);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const allSendableSelected =
    sendableRows.length > 0 && sendableRows.every((row) => selectedIds.has(row.id));

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Plain function, not a useCallback: `sendableRows` is rebuilt every render
  // from props, and memoizing against it is what the React Compiler refuses to
  // preserve. It compiles the memoization itself.
  const toggleAllSendable = () => {
    setSelectedIds((prev) => {
      const everySelected = sendableRows.length > 0 && sendableRows.every((row) => prev.has(row.id));
      return everySelected ? new Set() : new Set(sendableRows.map((row) => row.id));
    });
  };

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const exportQuery = new URLSearchParams();
  if (filters.range !== "all") exportQuery.set("days", filters.range);
  if (filters.visitorType !== "all") exportQuery.set("visitorType", filters.visitorType);
  if (filters.country !== "all") exportQuery.set("country", filters.country);
  if (filters.city !== "all") exportQuery.set("city", filters.city);
  if (filters.device !== "all") exportQuery.set("device", filters.device);
  if (filters.browser !== "all") exportQuery.set("browser", filters.browser);
  if (filters.os !== "all") exportQuery.set("os", filters.os);
  if (filters.source !== "all") exportQuery.set("source", filters.source);
  if (filters.q) exportQuery.set("q", filters.q);

  const hasActiveFilters =
    filters.visitorType !== "all" ||
    filters.country !== "all" ||
    filters.city !== "all" ||
    filters.device !== "all" ||
    filters.browser !== "all" ||
    filters.os !== "all" ||
    filters.source !== "all" ||
    Boolean(filters.q) ||
    filters.range !== "7";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <FilterSelect value={filters.range} onChange={(value) => setParams({ range: value })} options={RANGE_OPTIONS} />
        <FilterSelect
          value={filters.visitorType}
          onChange={(value) => setParams({ visitorType: value })}
          options={VISITOR_TYPE_OPTIONS}
        />
        <FilterSelect
          value={filters.country}
          onChange={(value) => setParams({ country: value })}
          options={[{ value: "all", label: "All countries" }, ...filterOptions.countries.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          value={filters.city}
          onChange={(value) => setParams({ city: value })}
          options={[{ value: "all", label: "All cities" }, ...filterOptions.cities.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          value={filters.device}
          onChange={(value) => setParams({ device: value })}
          options={[{ value: "all", label: "All devices" }, ...filterOptions.devices.map((d) => ({ value: d, label: d }))]}
        />
        <FilterSelect
          value={filters.browser}
          onChange={(value) => setParams({ browser: value })}
          options={[{ value: "all", label: "All browsers" }, ...filterOptions.browsers.map((b) => ({ value: b, label: b }))]}
        />
        <FilterSelect
          value={filters.os}
          onChange={(value) => setParams({ os: value })}
          options={[{ value: "all", label: "All systems" }, ...filterOptions.systems.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          value={filters.source}
          onChange={(value) => setParams({ source: value })}
          options={[{ value: "all", label: "All sources" }, ...filterOptions.sources.map((s) => ({ value: s, label: s }))]}
        />
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            <RotateCcw className="size-3.5" strokeWidth={2} />
            Reset
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search session, IP, city, browser…"
            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-gold"
          />
        </div>

        <div ref={columnsRef} className="relative">
          <button
            type="button"
            onClick={() => setColumnsOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Columns3 className="size-3.5" strokeWidth={2} />
            Columns
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 z-20 mt-1.5 max-h-80 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {TOGGLEABLE_COLUMNS.map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={() => toggleColumn(column.key)}
                    className="size-3.5 rounded border-slate-300"
                  />
                  {column.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <a
          href={`/api/admin/sessions/export?${exportQuery.toString()}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-white transition-colors hover:bg-ink/90"
        >
          <Download className="size-3.5" strokeWidth={2} />
          Export
        </a>
      </div>

      {selectedRows.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-ink/15 bg-ink/[0.03] px-3 py-2.5">
          <span className="text-xs font-medium text-slate-700">
            {selectedRows.length} session{selectedRows.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink/90"
          >
            <Send className="size-3.5" strokeWidth={2} />
            Grade and send to Meta
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      ) : null}

      <Table>
        <Thead>
          <Tr>
            <Th className="w-8">
              <input
                type="checkbox"
                checked={allSendableSelected}
                onChange={toggleAllSendable}
                disabled={sendableRows.length === 0}
                aria-label="Select all sendable sessions"
                title="Select every session on this page that Meta can match"
                className="size-3.5 rounded border-slate-300"
              />
            </Th>
            {shownColumns.map((column) => (
              <Th key={column.key} className={ALIGN_CLASS[column.align ?? "left"]}>
                {column.label}
              </Th>
            ))}
          </Tr>
        </Thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            rows.map((session) => (
              <Tr key={session.id} onClick={session.hasReplay ? () => openReplay(session) : undefined}>
                <Td onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(session.id)}
                    onChange={() => toggleRow(session.id)}
                    disabled={!session.capiSendable}
                    aria-label={`Select session ${session.id}`}
                    title={
                      session.capiSendable
                        ? undefined
                        : "Meta has no way to identify this visitor, so it cannot be graded."
                    }
                    className="size-3.5 rounded border-slate-300 disabled:opacity-30"
                  />
                </Td>
                {shownColumns.map((column) => (
                  <Td
                    key={column.key}
                    className={cn(ALIGN_CLASS[column.align ?? "left"], column.className)}
                    title={column.title?.(session)}
                    onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                  >
                    {column.render(session)}
                  </Td>
                ))}
              </Tr>
            ))
          )}
        </tbody>
      </Table>

      <p className="mt-3 text-xs text-slate-400">{rows.length} session{rows.length === 1 ? "" : "s"}</p>

      {activeSession ? <SessionReplayModal session={activeSession} onClose={closeReplay} /> : null}

      {bulkOpen ? (
        <SendSessionCapiBulkDialog
          sessions={selectedRows.map(toSendSession)}
          onClose={() => {
            setBulkOpen(false);
            clearSelection();
          }}
        />
      ) : null}
    </>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none transition-colors focus:border-gold"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
