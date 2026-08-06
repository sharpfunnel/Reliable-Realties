"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, Download, PlayCircle, RotateCcw, Search } from "lucide-react";

import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { SessionReplayModal } from "@/components/admin/SessionReplayModal";
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

type ColumnKey =
  | "sessionId"
  | "visitorId"
  | "ip"
  | "country"
  | "city"
  | "region"
  | "timezone"
  | "device"
  | "os"
  | "browser"
  | "screen"
  | "language"
  | "network"
  | "referrer"
  | "source"
  | "campaign"
  | "landingPage"
  | "currentPage"
  | "pagesViewed"
  | "avgScroll"
  | "maxScroll"
  | "mouseClicks"
  | "mouseMoves"
  | "formStarted"
  | "formSubmitted"
  | "ctaClicked";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  sessionId: "Session ID",
  visitorId: "Visitor ID",
  ip: "IP Address",
  country: "Country",
  city: "City",
  region: "Region",
  timezone: "Timezone",
  device: "Device",
  os: "Operating System",
  browser: "Browser",
  screen: "Screen Resolution",
  language: "Language",
  network: "Network",
  referrer: "Referrer",
  source: "Traffic Source",
  campaign: "Campaign",
  landingPage: "Landing Page",
  currentPage: "Current Page",
  pagesViewed: "Pages Viewed",
  avgScroll: "Avg Scroll %",
  maxScroll: "Max Scroll %",
  mouseClicks: "Mouse Clicks",
  mouseMoves: "Mouse Movements",
  formStarted: "Form Started",
  formSubmitted: "Form Submitted",
  ctaClicked: "CTA Clicked",
};

const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = Object.fromEntries(
  (Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => [key, true]),
) as Record<ColumnKey, boolean>;

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

function formatVisitTime(date: Date) {
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const toggleColumn = (key: ColumnKey) => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // The open replay is derived straight from the `?session=` URL param (set
  // when a row is clicked, or present on a shared deep link) rather than its
  // own state — the modal opens/closes as a side effect of navigation instead
  // of two sources of truth needing to stay in sync.
  const activeSessionId = searchParams.get("session");
  const activeSession = activeSessionId
    ? (rows.find((row) => row.id === activeSessionId && row.hasReplay) ?? null)
    : null;

  const openReplay = useCallback(
    (session: SessionRow) => {
      if (!session.hasReplay) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("session", session.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const closeReplay = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("session");
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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
              {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[key]}
                    onChange={() => toggleColumn(key)}
                    className="size-3.5 rounded border-slate-300"
                  />
                  {COLUMN_LABELS[key]}
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

      <Table>
        <Thead>
          <Tr>
            <Th>Replay</Th>
            <Th>Status</Th>
            {visibleColumns.sessionId ? <Th>Session ID</Th> : null}
            {visibleColumns.visitorId ? <Th>Visitor ID</Th> : null}
            <Th>Visitor Type</Th>
            <Th>Visit Time</Th>
            <Th>Time Ago</Th>
            {visibleColumns.ip ? <Th>IP Address</Th> : null}
            {visibleColumns.country ? <Th>Country</Th> : null}
            {visibleColumns.city ? <Th>City</Th> : null}
            {visibleColumns.region ? <Th>Region</Th> : null}
            {visibleColumns.timezone ? <Th>Timezone</Th> : null}
            {visibleColumns.device ? <Th>Device</Th> : null}
            {visibleColumns.os ? <Th>Operating System</Th> : null}
            {visibleColumns.browser ? <Th>Browser</Th> : null}
            {visibleColumns.screen ? <Th>Screen Resolution</Th> : null}
            {visibleColumns.language ? <Th>Language</Th> : null}
            {visibleColumns.network ? <Th>Network</Th> : null}
            {visibleColumns.referrer ? <Th>Referrer</Th> : null}
            {visibleColumns.source ? <Th>Traffic Source</Th> : null}
            {visibleColumns.campaign ? <Th>Campaign</Th> : null}
            {visibleColumns.landingPage ? <Th>Landing Page</Th> : null}
            {visibleColumns.currentPage ? <Th>Current Page</Th> : null}
            {visibleColumns.pagesViewed ? <Th>Pages Viewed</Th> : null}
            <Th className="text-right">Duration</Th>
            {visibleColumns.avgScroll ? <Th>Avg Scroll %</Th> : null}
            {visibleColumns.maxScroll ? <Th>Max Scroll %</Th> : null}
            {visibleColumns.mouseClicks ? <Th>Mouse Clicks</Th> : null}
            {visibleColumns.mouseMoves ? <Th>Mouse Movements</Th> : null}
            {visibleColumns.formStarted ? <Th>Form Started</Th> : null}
            {visibleColumns.formSubmitted ? <Th>Form Submitted</Th> : null}
            {visibleColumns.ctaClicked ? <Th>CTA Clicked</Th> : null}
            <Th>Bounce</Th>
          </Tr>
        </Thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            rows.map((session) => (
              <Tr key={session.id} onClick={session.hasReplay ? () => openReplay(session) : undefined}>
                <Td>
                  {session.hasReplay ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gold">
                      <PlayCircle className="size-3.5" strokeWidth={2} />
                      Watch
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={session.status} />
                </Td>
                {visibleColumns.sessionId ? (
                  <Td className="font-mono text-xs text-slate-500" title={session.id}>
                    s_{session.id.slice(0, 12)}
                  </Td>
                ) : null}
                {visibleColumns.visitorId ? (
                  <Td className="font-mono text-xs text-slate-500" title={session.visitorId}>
                    v_{session.fingerprint.slice(0, 12)}
                  </Td>
                ) : null}
                <Td>
                  <span className={session.isReturning ? "text-gold" : "text-slate-500"}>
                    {session.isReturning ? "Returning" : "New"}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{formatVisitTime(session.startedAt)}</Td>
                <Td className="whitespace-nowrap text-slate-500">{formatRelative(session.startedAt)}</Td>
                {visibleColumns.ip ? <Td className="whitespace-nowrap">{session.ipAddress ?? "—"}</Td> : null}
                {visibleColumns.country ? <Td>{session.country ?? "—"}</Td> : null}
                {visibleColumns.city ? <Td>{session.city ?? "—"}</Td> : null}
                {visibleColumns.region ? <Td>{session.region ?? "—"}</Td> : null}
                {visibleColumns.timezone ? <Td className="whitespace-nowrap">{session.timezone ?? "—"}</Td> : null}
                {visibleColumns.device ? <Td className="capitalize">{session.deviceType ?? "—"}</Td> : null}
                {visibleColumns.os ? <Td>{session.os ?? "—"}</Td> : null}
                {visibleColumns.browser ? <Td>{session.browser ?? "—"}</Td> : null}
                {visibleColumns.screen ? (
                  <Td className="whitespace-nowrap">
                    {session.screenWidth && session.screenHeight ? `${session.screenWidth}×${session.screenHeight}` : "—"}
                  </Td>
                ) : null}
                {visibleColumns.language ? <Td>{session.language ?? "—"}</Td> : null}
                {visibleColumns.network ? <Td>{session.network ? session.network.toUpperCase() : "—"}</Td> : null}
                {visibleColumns.referrer ? (
                  <Td className="max-w-40 truncate" title={session.referrer ?? undefined}>
                    {session.referrer ?? "Direct"}
                  </Td>
                ) : null}
                {visibleColumns.source ? <Td>{session.trafficSource}</Td> : null}
                {visibleColumns.campaign ? <Td>{session.utmCampaign ?? "—"}</Td> : null}
                {visibleColumns.landingPage ? (
                  <Td className="max-w-32 truncate font-mono text-xs" title={session.entryPath ?? undefined}>
                    {session.entryPath ?? "—"}
                  </Td>
                ) : null}
                {visibleColumns.currentPage ? (
                  <Td className="max-w-32 truncate font-mono text-xs" title={session.currentPath ?? undefined}>
                    {session.currentPath ?? "—"}
                  </Td>
                ) : null}
                {visibleColumns.pagesViewed ? <Td className="text-center">{session.pagesViewed}</Td> : null}
                <Td className="text-right">{formatDuration(session.totalDuration)}</Td>
                {visibleColumns.avgScroll ? <Td>{session.avgScrollPct}%</Td> : null}
                {visibleColumns.maxScroll ? <Td>{session.maxScrollPct}%</Td> : null}
                {visibleColumns.mouseClicks ? <Td className="text-center">{session.mouseClicks}</Td> : null}
                {visibleColumns.mouseMoves ? <Td className="text-center">{session.mouseMovements}</Td> : null}
                {visibleColumns.formStarted ? (
                  <Td>
                    <YesNo value={session.formStarted} />
                  </Td>
                ) : null}
                {visibleColumns.formSubmitted ? (
                  <Td>
                    <YesNo value={session.formSubmitted} />
                  </Td>
                ) : null}
                {visibleColumns.ctaClicked ? (
                  <Td>
                    <YesNo value={session.ctaClicked} />
                  </Td>
                ) : null}
                <Td>
                  <span className={cn("font-medium", session.isBounce ? "text-red-500" : "text-emerald-600")}>
                    {session.isBounce ? "Yes" : "No"}
                  </span>
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>

      <p className="mt-3 text-xs text-slate-400">{rows.length} session{rows.length === 1 ? "" : "s"}</p>

      {activeSession ? <SessionReplayModal session={activeSession} onClose={closeReplay} /> : null}
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
