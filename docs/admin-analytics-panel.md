# Admin Analytics Panel — how it works

A reference doc for the `/admin` panel in this project: a self-built, first-party
alternative to Google Analytics + a lead CRM + (optionally) a Meta Ads dashboard,
all baked directly into the Next.js app. No third-party analytics SaaS, no
tracking library — every byte of data is captured by code in this repo and
stored in our own Postgres database. This doc exists so the same pattern can be
rebuilt in other projects; skip whatever section doesn't apply to that project
(e.g. Meta Ads).

---

## 1. The shape of it

Two halves that only share the database:

```
Public site                         /admin panel (password-protected)
────────────                        ──────────────────────────────────
<Tracker /> mounted in               Server Components query Postgres
root layout, on every page           directly with Prisma and render
except /admin                        dashboards. No client-side data
    │                                fetching, no REST/GraphQL API layer
    ▼                                for the dashboards themselves.
in-memory batching queue
    │ (flush every 5s / 20 events / tab-hide)
    ▼
POST /api/track  ──┐
POST /api/leads  ──┼──► Postgres (Prisma)  ◄── read by every /admin page
POST /api/replay ──┘
```

Nothing on the public site ever calls the admin pages, and the admin pages
never call the tracking API — they both just read/write the same tables.

**Stack**: Next.js App Router, Prisma + Postgres (Neon, pooled + direct
connection split for the migration engine), Tailwind CSS v4, `jose` for a JWT
session cookie (no NextAuth/Clerk — single shared operator password),
`rrweb` for session replay, `web-vitals` for Core Web Vitals, `lucide-react`
for icons. **No charting library** — every chart on the dashboard (line/area,
donut, funnel, world map) is hand-rolled inline SVG.

---

## 2. Data model

Everything lives in one `prisma/schema.prisma`. Two "identity" tables, a pile
of small "event" tables that each FK to a session, one "money" table, and an
optional ad-platform subsystem.

### Identity

- **`Visitor`** — one row per browser, keyed by a client-generated
  `fingerprint` (a UUID stashed in `localStorage`, *not* real fingerprinting).
  Carries everything that's true "about this browser": geo (`country`,
  `region`, `city` — filled server-side from the request, not trusted from
  the client), `timezone`, `language`, `browser`/`browserVersion`, `os`/
  `osVersion`, `deviceType`, `screenWidth`/`screenHeight`, `network`/
  `downlink` (Network Information API — Safari/Firefox don't support it, so
  expect a lot of nulls), and `isReturning` (flipped to `true` the first time
  this fingerprint is seen a second time).
- **`Session`** — one row per browsing session (30 min idle timeout, see
  §3). Carries everything that's true "about this visit": `startedAt`/
  `endedAt`/`totalDuration`, `isBounce`, `pagesViewed`, `entryPath`/
  `exitPath`, `referrer`, the full UTM set (`utmSource/Medium/Campaign/
  Content/Term`), ad click ids (`gclid`, `fbclid`, `msclkid`), Meta's dynamic
  ad params (`placement`, `metaCampaignId`, `metaAdsetId`, `metaAdId`), a
  catch-all `rawParams` JSON of *every* query param on the landing URL (so a
  new ad platform's param is never silently dropped just because it has no
  dedicated column), and `ipAddress`/viewport size.

### Behavioral events — all FK'd to `Session`

| Model | Captures |
|---|---|
| `PageView` | path, title, time-on-page |
| `Event` | generic named event + JSON metadata (escape hatch for anything not in a dedicated table) |
| `ScrollEvent` | scroll-depth milestones (25/50/75/100%) + time-to-reach |
| `CtaEvent` | viewed / hovered / clicked, keyed by a `data-cta-id` attribute |
| `FormEvent` | viewed / started / field_focus / field_complete / validation_error / abandoned / submitted, keyed by `data-form-id` |
| `MouseEvent` | rage-click, dead-click, double-click (heuristics, see §3) |
| `HeatmapEvent` | click/hover position as `xPct`/`yPct` of full page height (not viewport — stays valid across viewport sizes), plus the CSS selector and visible text of the element hit |
| `PerformanceMetric` | Core Web Vitals (LCP/INP/CLS/FCP/TTFB) via `web-vitals`, with Google's good/needs-improvement/poor rating |
| `ErrorEvent` | JS errors, unhandled promise rejections, broken `<img>` loads |
| `SessionReplay` | gzip-compressed chunks of raw `rrweb` events (DOM mutations) — reconstructed into a video-like player in the admin |

### Conversion

- **`Lead`** — the actual enquiry. `name`/`phone`/`email`/`budget`/`message`,
  loosely linked to `Visitor`/`Session` (nullable FKs — a lead should never
  fail to save just because tracking identity failed), `status` (new →
  contacted → qualified → won/lost, app-enforced not DB-enforced), and
  `metaCapiSentAt`/`metaCapiError` for the server-side ad-conversion send.

### Meta Ads (optional — skip if the target project doesn't run Meta ads)

`MetaAdAccount` → `Campaign` → `AdSet` → `Ad`, each synced from the Graph API,
plus `MetaInsight` (one row per entity per day: spend, impressions, clicks,
CTR/CPC/CPM, results, cost-per-result). See §9.

---

## 3. How data gets captured — the tracking pipeline

**Identity** (`lib/track/client/ids.ts`) — two ids, two lifetimes:
- `rr_vid` in `localStorage`: a UUID, effectively permanent, identifies the
  *visitor* (→ `Visitor.fingerprint`).
- `rr_sid` in `sessionStorage`: a UUID, refreshed whenever it's more than 30
  minutes since the last activity — identifies the *session* (→
  `Session.clientId`). This is what makes a "session" mean something: same
  tab, active within the last half hour.

**Attribution capture** (`lib/track/client/device.ts` →
`getOrCreateEntryMeta()`) — UTM params, click ids, and referrer are read from
`window.location.search` **once**, on the very first pageview, and cached in
`sessionStorage`. Without this cache, a visitor who lands on
`/?utm_source=meta` and then clicks through to an internal page with no query
string would have their attribution silently overwritten with blanks on the
next flush.

**Device/browser/OS parsing** — done with plain regex against
`navigator.userAgent` (`lib/track/client/device.ts`), no dependency. Good
enough for a dashboard; not meant to be bulletproof.

**Event collectors** — one small client module per concern, each attaches
DOM listeners and calls into a shared `track.*()` API:
- `scroll.ts` — `requestAnimationFrame`-throttled scroll listener, fires once
  per milestone (25/50/75/100%) per page.
- `cta.ts` — `IntersectionObserver` (viewed) + `mouseenter`/`click` listeners
  on every element with `data-cta-id`, plus a `MutationObserver` so elements
  added after initial mount (client-side nav, dynamic content) are picked up
  automatically. **This is the whole convention**: tag any button/link
  `data-cta-id="hero-call"` and it's tracked with zero additional JS.
- `forms.ts` — same idea for `<form data-form-id="contact">`: viewed,
  first-focus = started, field-level focus/complete/validation-error, submit,
  and (on `pagehide`) "abandoned" if it was started but never submitted.
- `mouse.ts` — rage-click (3+ clicks on the same element within 1s),
  dead-click (click on a non-interactive element that produces no DOM
  mutation within 600ms — a `MutationObserver` decides), double-click, and a
  throttled (1.5s) mousemove sampler that feeds the hover heatmap.
- `vitals.ts` — thin wrapper around `web-vitals`'s `onLCP/onINP/onCLS/onFCP/
  onTTFB`.
- `errors.ts` — `window.onerror`, `unhandledrejection`, and capture-phase
  `error` on `<img>` (broken image loads).
- `replay.ts` — lazy-loads `rrweb`, records DOM snapshots, batches them
  through its **own** queue/endpoint (`/api/replay`, separate from the main
  batch — replay payloads are large and gzip-compressed server-side before
  insert).

**The batching queue** (`lib/track/client/queue.ts`) — everything from every
collector above lands in one in-memory batch object. It flushes to
`POST /api/track` when: 5 seconds pass, 20 events accumulate, or the tab is
hidden/closed (via `navigator.sendBeacon` for the hide/close case, since a
regular `fetch` can be cancelled mid-flight when the page unloads). One
network request per flush carries every event type at once — pageviews,
scrolls, CTA/form events, perf metrics, errors, mouse events, heatmap points
— rather than one request per event.

**Ingestion** (`app/api/track/route.ts` + `lib/track/ingest.ts`):
1. Upsert `Visitor` by fingerprint — refreshes geo (via `@vercel/functions`'
   `geolocation()`, which reads Vercel's edge-injected headers; falls back to
   `x-forwarded-for` locally) and device info on **every** hit, so a
   returning visitor's browser-version bump is reflected without a new row.
2. Find-or-create `Session` by `clientId` — first hit in a session writes all
   the acquisition fields; later hits in the same session are no-ops here.
3. Bulk-`createMany` every queued event type into its table.
4. Recompute `Session.pagesViewed`/`isBounce` (bounce = single page **and**
   under 10s **and** no scroll/CTA/form/custom event — so a fast bounce isn't
   miscounted just because the visitor scrolled once) and, if this flush was
   the tab-hide/close beacon, stamp `endedAt`/`totalDuration`.

Both `upsertVisitor`/`findOrCreateSession` catch unique-constraint races
(`P2002`) and re-read instead of failing — `/api/track`'s beacon and
`/api/leads`' own identity upsert can both fire for the same brand-new
visitor at nearly the same instant.

**Leads** (`app/api/leads/route.ts`) — a separate endpoint (own copy of the
visitor/session upsert, since a lead can arrive before the tracker's own
first flush lands) that validates input server-side, creates the `Lead` row,
and — via Next's `waitUntil()` — fires a server-side Meta Conversions API
event in the background without blocking the response the visitor sees. A
`PATCH` on the same route lets a thank-you-page follow-up form fill in
optional fields (email/budget/message) after the required name+phone already
saved a lead.

**`<Tracker />`** (`components/track/Tracker.tsx`) is mounted once in the
root layout and no-ops on any `/admin` path — it initializes every collector
above on mount and finalizes the current pageview's `timeOnPage` on route
change / tab-hide.

---

## 4. Auth

Deliberately the simplest thing that works for a single-operator panel — no
user table, no roles, no `middleware.ts`:

- One password in `ADMIN_PASSWORD` (env var).
- `lib/auth/session.ts` signs a JWT (`jose`, HS256, `{ role: "admin" }`, 7-day
  expiry) into an `httpOnly` cookie on login.
- `lib/auth/dal.ts` exports `verifyAdminSession()` — wrapped in React's
  `cache()` so it only actually verifies once per request even though every
  nested Server Component could call it — which `redirect()`s to
  `/admin/login` on a missing/invalid/expired token.
- **The only place that's called** is the top of
  `app/admin/(dashboard)/layout.tsx`. Because every admin route lives inside
  that one route group, one check at the layout protects all of them — no
  per-page auth code, no middleware. (Trade-off: a new top-level route
  accidentally placed *outside* the `(dashboard)` group would be
  unprotected — there's no edge-level backstop. Fine for a single admin
  password; add `middleware.ts` too if that risk matters more.)

---

## 5. The admin pages

Nav is a flat list of pills in `AdminNav.tsx`, with live Leads/Sessions count
badges (`getNavCounts()`). Every page is a Server Component that awaits its
queries directly — no client-side fetching, no loading spinners for the
initial render (`export const dynamic = "force-dynamic"` on the layout, so
every hit is fresh, never statically cached).

| Route | Purpose | Backing queries |
|---|---|---|
| `/admin` (Overview) | The daily-check dashboard: 10 stat tiles with period-over-period % deltas, a zoomable visitors/sessions/leads area chart with a live-visitor badge, conversion funnel, traffic sources table, devices/browsers/top-pages breakdown, a real projected world map of visitors by country, recent leads | `getOverviewStats`, `getDailyTimeSeries`, `getTrafficSources`, `getFunnelStats`, `getLiveVisitorCount`, `getDeviceBreakdown`, `getBrowserBreakdown`, `getTopPages`, `getVisitorsByCountry`, `getRecentLeads` |
| `/admin/leads` | The CRM: every enquiry, filterable by status/source/campaign/country/device/date-range/free-text search, paginated, status changeable inline (dropdown → server action → `revalidatePath`), click a row for a full behavioral detail panel (visit count, landing page, page-by-page time breakdown, event timeline, replay link) | `getLeads`, `getLeadStats`, `getLeadFilterOptions`, `getLeadDetail` (on demand) |
| `/admin/sessions` | Every visit with full technical + behavioral context: device/browser/OS/geo, scroll depth, mouse activity, form/CTA engagement, live/bounced/completed status, replay button | `getSessions`, `getSessionStats`, `getSessionFilterOptions`, `getSessionTimeline` (in the replay modal) |
| `/admin/heatmap` | Click/hover/scroll heatmap overlaid on an iframe of the live page, filterable by path/date-range/device; ranked "most clicked/hovered elements" list (clustered by CSS selector, not raw point cloud) with conversion-rate-per-element for clicks | `getHeatmapPaths`, `getHeatmapPoints`, `getHeatmapSummary`, `getInteractionHotspots`, `getScrollDepthProfile` |
| `/admin/tech-stack` | What visitors actually browse on, and how each cohort performs: devices/browsers/OS/screen-resolution/viewport-size/language/connection-quality breakdowns, plus bounce-rate & conversion-rate *by browser* and *by OS* — the "is Safari secretly broken" page | `getTechStackData` |
| `/admin/funnels` | Page View → Scroll 25%+ → CTA Click → Form Start → Lead Submit, all-traffic vs Meta-ads-only toggle | `getFunnelStats` |
| `/admin/ctas` | Per-CTA viewed/hovered/clicked/CTR table | `getCtaStats` |
| `/admin/forms` | Per-form viewed/started/submitted/abandoned/validation-error/completion-rate table | `getFormStats` |
| `/admin/performance` | Core Web Vitals distribution (good/needs-improvement/poor) per metric | `getPerformanceStats` |
| `/admin/errors` | Last 100 client-side errors | `getErrors` |
| `/admin/campaigns` + `/admin/campaigns/[id]` | Meta Ads spend/impressions/clicks/CTR/CPC/results, campaign → ad-set → ad drill-down, joined against on-site sessions/leads per campaign | `lib/meta/queries.ts` (§9) |
| `/admin/meta-capi` | Dry-run composer for Conversions API payloads (build + inspect, never sends) plus the real delivery log for every lead's automatic server-side send | `lib/meta/queries.ts`, `lib/meta/capi.ts` (§9) |
| `/admin/reports` | Date-ranged CSV/XLSX/PDF export of Overview/Leads/Campaigns | `lib/admin/reports.ts` + `/api/reports/*` |

---

## 6. Shared building blocks

Every page composes from the same small set of primitives instead of
reinventing layout each time:

- **`PageHeader`** — title + description + right-aligned actions slot.
- **`StatTile`** — icon, label, value, optional `subLabel`, optional `delta`
  (renders a green ↑ / red ↓ pill; `null` delta means "no prior-period data",
  rendered as no badge rather than a fake 0%).
- **`Table`/`Thead`/`Th`/`Tr`/`Td`/`EmptyState`** — every data table in the
  panel uses these four, never a raw `<table>`.
- **Hand-rolled SVG charts** — deliberately no charting library:
  - `TimeSeriesChart` — multi-series line+area chart with a hover tooltip and
    a drag-to-zoom brush underneath, all in `<svg>` + a couple of `useState`s.
  - `ConversionFunnel` — horizontal bars sized by % of the first stage, with
    per-stage drop-off %.
  - `DevicesDonut` — a donut built from stacked `stroke-dasharray` circles.
  - `BarList` — generic horizontal bar-list (reused for browsers, OS, CTAs...
    anywhere it's "label + count, ranked").
  - `WorldMap` — **real** country borders, not a decorative blob map: see the
    box below.
  - `CountryList` — flag emoji (derived from the ISO-2 code via Unicode
    regional-indicator math, no image assets) + bar + visitor/lead counts.
- **`DateRangeSelect`** — a pill segmented control that navigates
  `?days=7|14|30|90`, read server-side by the page (no client state).
- **`LiveBadge`** — the one genuinely "live" widget: renders the
  server-computed initial count, then polls a tiny authenticated API route
  (`/api/admin/live`) every 20s from the client for a fresher number.

> **How the world map is real, not decorative**: hand-drawing continent
> shapes looks obviously wrong. Instead, `lib/admin/worldMapPaths.ts` is
> *generated*, once, offline: download the public-domain Natural Earth 110m
> dataset (via the `world-atlas` package), project it with `d3-geo`'s
> `geoEquirectangular().fitExtent(...)`, and emit the resulting SVG `d`
> attributes as a plain TS array. `d3-geo`/`topojson-client` are installed
> with `npm install --no-save` for that one generation run and removed
> immediately after — the shipped app has no map-library dependency at all,
> just ~115KB of static path data. Visitor markers (`lib/admin/geo.ts`) are
> projected through that exact same projection instance so a dot always
> lands inside the country it represents.

**Styling**: Tailwind, a light ink/gold theme throughout — except the
Heatmap page, which is intentionally dark to visually match the live page
it's overlaying data on.

---

## 7. Meta Ads / Conversions API (optional subsystem)

Only relevant if the target project runs Meta (Facebook/Instagram) ads.
Two independent pieces that share the `Lead`/`Campaign` tables:

- **Ads sync** — OAuth connect flow (`/api/meta/oauth/start` →
  `/callback`) stores a long-lived access token on `MetaAdAccount`. A cron
  route (`/api/cron/meta-sync`, gated by a `CRON_SECRET` header so it can't be
  hit by randoms) pulls Campaigns → AdSets → Ads → daily Insights from the
  Graph API and upserts them (`lib/meta/sync.ts`), refreshing the token when
  it's within 7 days of expiry.
- **Conversions API (CAPI)** — server-side (not just browser-pixel)
  conversion events, so ad-blockers/ITP don't cost you attribution.
  `sendLeadConversionEvent()` fires automatically, fire-and-forget, for every
  new `Lead`. `/admin/meta-capi` is a **dry-run only** composer — it builds
  and displays the exact payload (including PII hashing) without ever
  contacting Meta, so you can sanity-check the shape before trusting the
  automatic sender, plus a manual "send now" action for backfilling old
  leads or testing, and a delivery log (`metaCapiSentAt`/`metaCapiError` on
  each `Lead`).

---

## 8. Reports / exports

`lib/admin/reports.ts` computes date-ranged rollups (Overview/Leads/
Campaigns); `/api/reports/{overview,leads,campaigns}` streams them out as
CSV (`lib/reports/csv.ts`), XLSX (`exceljs`), or PDF (`pdfkit`). Pure
read-and-format — no new data model.

---

## 9. Rebuilding this pattern in another project — checklist

The genuinely reusable part isn't the real-estate-specific pages — it's the
**capture pipeline + admin-panel scaffolding**. In priority order:

1. **Schema first.** Model `Visitor` (identity) + `Session` (one visit) +
   whatever "conversion" entity matters for that project (`Order`, `Signup`,
   `Booking`... — this repo's is `Lead`). Add event tables only as you need
   them; you don't need all nine on day one.
2. **Client identity**: a `localStorage` UUID for the visitor, a
   `sessionStorage` UUID with an idle-timeout refresh for the session. Copy
   `lib/track/client/ids.ts` near-verbatim.
3. **One batching queue, one ingestion endpoint.** Every event type funnels
   into the same in-memory batch, flushed on a timer/size-threshold/tab-hide
   (`sendBeacon` for the last one), posted as one JSON body to one API route.
   Resist the urge to give each event type its own endpoint.
4. **Markup conventions over bespoke JS.** `data-cta-id`/`data-form-id` (or
   whatever fits the project) mean tracking a new button is a markup change,
   not a code change. This is the highest-leverage idea in the whole system.
5. **Enrich server-side, never trust the client for geo/IP.** Read geo off
   the request at the ingestion endpoint (Vercel's `geolocation()`, or an
   IP-lookup service elsewhere).
6. **Auth**: for a single-operator panel, a password + JWT cookie +
   one `verifyAdminSession()` call at the top of a route-group layout is
   genuinely enough. Don't reach for a full auth provider until there's more
   than one operator or role.
7. **Build pages in this order**: Overview (the daily check) → the
   conversion-entity list (your Leads-equivalent CRM) → Sessions. Everything
   past that — Heatmap, Funnels, CTAs, Forms, Performance, Errors, session
   replay — is genuinely optional polish; add only what you'll actually look
   at. Session replay (`rrweb`) and heatmaps are the highest-effort features
   here by a wide margin — build them last, if at all.
8. **Shared primitives before pages.** `PageHeader`, `StatTile`, a `Table`
   set, and a small SVG-chart toolkit (line/area, donut, bar-list, funnel)
   pay for themselves after the second page reuses them. Don't pull in a
   charting library until an SVG chart genuinely can't do what's needed —
   dashboard-scale charts rarely need one.
9. **Reports/exports last**, and only if someone will actually download
   them — it's pure plumbing on top of data you already have.

### File map (for copying the pattern)

```
lib/track/
  client/ids.ts        visitor + session identity
  client/device.ts      UA parsing + entry attribution capture
  client/queue.ts        batching + flush
  client/*.ts            one collector per event type
  ingest.ts               server-side upsert/enrich helpers
app/api/track/route.ts    the one ingestion endpoint
components/track/Tracker.tsx   mounted once in the root layout

lib/auth/session.ts, dal.ts, actions.ts     JWT cookie auth
app/admin/login/page.tsx
app/admin/(dashboard)/layout.tsx            the one auth check

lib/admin/queries.ts       every read query the dashboards use
components/admin/          shared UI primitives + charts
app/admin/(dashboard)/*/page.tsx   one folder per dashboard page
```
