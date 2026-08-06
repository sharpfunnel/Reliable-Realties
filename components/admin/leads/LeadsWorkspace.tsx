"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  RotateCcw,
  Search,
} from "lucide-react";

import { Table, Thead, Th, Tr, Td, EmptyState } from "@/components/admin/Table";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { SendCapiModal } from "@/components/admin/SendCapiModal";
import { LeadDetailPanel } from "@/components/admin/leads/LeadDetailPanel";
import type { LeadRow } from "@/lib/admin/queries";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

type ToggleableColumnKey =
  | "phone"
  | "email"
  | "budget"
  | "message"
  | "city"
  | "country"
  | "source"
  | "campaign"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "device"
  | "browser"
  | "os"
  | "ip"
  | "capi"
  | "createdAt";

const COLUMN_LABELS: Record<ToggleableColumnKey, string> = {
  phone: "Phone",
  email: "Email",
  budget: "Budget",
  message: "Message",
  city: "City",
  country: "Country",
  source: "Source",
  campaign: "Campaign",
  utmSource: "UTM Source",
  utmMedium: "UTM Medium",
  utmCampaign: "UTM Campaign",
  device: "Device",
  browser: "Browser",
  os: "Operating System",
  ip: "IP Address",
  capi: "Meta CAPI",
  createdAt: "Created At",
};

const DEFAULT_VISIBLE: Record<ToggleableColumnKey, boolean> = Object.fromEntries(
  (Object.keys(COLUMN_LABELS) as ToggleableColumnKey[]).map((key) => [key, true]),
) as Record<ToggleableColumnKey, boolean>;

export type LeadsFilterValues = {
  status: string;
  source: string;
  campaign: string;
  country: string;
  device: string;
  q: string;
  range: string;
};

export function LeadsWorkspace({
  rows,
  total,
  page,
  pageSize,
  filters,
  filterOptions,
}: {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: LeadsFilterValues;
  filterOptions: { sources: string[]; countries: string[]; devices: string[]; campaigns: string[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all" || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (resetPage) params.delete("page");
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

  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const toggleColumn = (key: ToggleableColumnKey) =>
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) setColumnsOpen(false);
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) setExportOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const exportQuery = new URLSearchParams();
  if (filters.status !== "all") exportQuery.set("status", filters.status);
  if (filters.source !== "all") exportQuery.set("source", filters.source);
  if (filters.campaign !== "all") exportQuery.set("campaign", filters.campaign);
  if (filters.country !== "all") exportQuery.set("country", filters.country);
  if (filters.device !== "all") exportQuery.set("device", filters.device);
  if (filters.q) exportQuery.set("q", filters.q);
  exportQuery.set("range", filters.range);

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.source !== "all" ||
    filters.campaign !== "all" ||
    filters.country !== "all" ||
    filters.device !== "all" ||
    Boolean(filters.q) ||
    filters.range !== "30";

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <FilterSelect
          value={filters.range}
          onChange={(value) => setParams({ range: value })}
          options={RANGE_OPTIONS}
        />
        <FilterSelect
          value={filters.status}
          onChange={(value) => setParams({ status: value })}
          options={[{ value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]}
        />
        <FilterSelect
          value={filters.source}
          onChange={(value) => setParams({ source: value })}
          options={[{ value: "all", label: "All sources" }, ...filterOptions.sources.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          value={filters.campaign}
          onChange={(value) => setParams({ campaign: value })}
          options={[{ value: "all", label: "All campaigns" }, ...filterOptions.campaigns.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          value={filters.country}
          onChange={(value) => setParams({ country: value })}
          options={[{ value: "all", label: "All countries" }, ...filterOptions.countries.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          value={filters.device}
          onChange={(value) => setParams({ device: value })}
          options={[{ value: "all", label: "All devices" }, ...filterOptions.devices.map((d) => ({ value: d, label: d }))]}
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
            placeholder="Search name, phone, email, lead ID"
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
              {(Object.keys(COLUMN_LABELS) as ToggleableColumnKey[]).map((key) => (
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

        <div ref={exportRef} className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-white transition-colors hover:bg-ink/90"
          >
            <Download className="size-3.5" strokeWidth={2} />
            Export
          </button>
          {exportOpen ? (
            <div className="absolute right-0 z-20 mt-1.5 w-32 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {(["csv", "xlsx"] as const).map((format) => (
                <a
                  key={format}
                  href={`/api/leads/export?${exportQuery.toString()}&format=${format}`}
                  className="block rounded-lg px-2.5 py-1.5 text-xs font-medium uppercase text-slate-600 hover:bg-slate-50"
                >
                  {format}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>Lead ID</Th>
            <Th>Name</Th>
            {visibleColumns.phone ? <Th>Phone</Th> : null}
            {visibleColumns.email ? <Th>Email</Th> : null}
            {visibleColumns.budget ? <Th>Budget</Th> : null}
            {visibleColumns.message ? <Th>Message</Th> : null}
            {visibleColumns.city ? <Th>City</Th> : null}
            {visibleColumns.country ? <Th>Country</Th> : null}
            {visibleColumns.source ? <Th>Source</Th> : null}
            {visibleColumns.campaign ? <Th>Campaign</Th> : null}
            {visibleColumns.utmSource ? <Th>UTM Source</Th> : null}
            {visibleColumns.utmMedium ? <Th>UTM Medium</Th> : null}
            {visibleColumns.utmCampaign ? <Th>UTM Campaign</Th> : null}
            {visibleColumns.device ? <Th>Device</Th> : null}
            {visibleColumns.browser ? <Th>Browser</Th> : null}
            {visibleColumns.os ? <Th>Operating System</Th> : null}
            {visibleColumns.ip ? <Th>IP Address</Th> : null}
            <Th>Current Status</Th>
            {visibleColumns.capi ? <Th>Meta CAPI</Th> : null}
            {visibleColumns.createdAt ? <Th>Created At</Th> : null}
          </Tr>
        </Thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            rows.map((row) => (
              <Tr key={row.id} onClick={() => setSelectedLead(row)}>
                <Td className="whitespace-nowrap font-mono text-xs text-slate-500">{row.displayId}</Td>
                <Td className="font-medium text-slate-800">{row.name ?? "—"}</Td>
                {visibleColumns.phone ? <Td className="whitespace-nowrap">{row.phone ?? "—"}</Td> : null}
                {visibleColumns.email ? <Td>{row.email ?? "—"}</Td> : null}
                {visibleColumns.budget ? <Td className="whitespace-nowrap">{row.budget ?? "—"}</Td> : null}
                {visibleColumns.message ? (
                  <Td className="max-w-55 truncate" title={row.message ?? undefined}>
                    {row.message ?? "—"}
                  </Td>
                ) : null}
                {visibleColumns.city ? <Td>{row.city ?? "—"}</Td> : null}
                {visibleColumns.country ? <Td>{row.country ?? "—"}</Td> : null}
                {visibleColumns.source ? <Td className="capitalize">{row.source ?? "—"}</Td> : null}
                {visibleColumns.campaign ? <Td>{row.campaign ?? "—"}</Td> : null}
                {visibleColumns.utmSource ? <Td title={row.rawParamsPreview ?? undefined}>{row.utmSource ?? "—"}</Td> : null}
                {visibleColumns.utmMedium ? <Td>{row.utmMedium ?? "—"}</Td> : null}
                {visibleColumns.utmCampaign ? <Td>{row.utmCampaign ?? "—"}</Td> : null}
                {visibleColumns.device ? <Td>{row.device ?? "—"}</Td> : null}
                {visibleColumns.browser ? <Td>{row.browser ?? "—"}</Td> : null}
                {visibleColumns.os ? <Td>{row.os ?? "—"}</Td> : null}
                {visibleColumns.ip ? <Td className="font-mono text-xs">{row.ipAddress ?? "—"}</Td> : null}
                <Td onClick={(event) => event.stopPropagation()}>
                  <LeadStatusSelect leadId={row.id} status={row.status} />
                </Td>
                {visibleColumns.capi ? (
                  <Td onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {row.metaCapiSentAt ? (
                        <span className="text-[11px] font-medium text-emerald-600">Sent</span>
                      ) : row.metaCapiError ? (
                        <span className="text-[11px] font-medium text-red-500" title={row.metaCapiError}>
                          Failed
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                      <SendCapiModal
                        lead={{
                          id: row.id,
                          name: row.name,
                          email: row.email,
                          phone: row.phone,
                          source: row.source,
                          city: row.city,
                          country: row.country,
                          metaAdId: row.metaAdId,
                          placement: row.placement,
                          fbclid: row.fbclid,
                        }}
                      />
                    </div>
                  </Td>
                ) : null}
                {visibleColumns.createdAt ? (
                  <Td className="whitespace-nowrap">{row.createdAt.toLocaleString()}</Td>
                ) : null}
              </Tr>
            ))
          )}
        </tbody>
      </Table>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {total === 0 ? "0 results" : `${from}–${to} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) }, false)}
            className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" strokeWidth={2} />
          </button>
          <span className="px-1.5">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setParams({ page: String(page + 1) }, false)}
            className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {selectedLead ? (
        <LeadDetailPanel key={selectedLead.id} lead={selectedLead} onClose={() => setSelectedLead(null)} />
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
