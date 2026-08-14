# Lead submission fix — Meta in-app browser leads not appearing

**Date:** 2026-08-14
**Reported issue:** Sessions were tracking correctly in the admin panel, but leads submitted from the Meta in-app browser (Facebook/Instagram webview) were not showing up.

## Investigation summary

The lead pipeline is: lead form (client) → `POST /api/leads` → Prisma → Postgres (Neon) → admin `getLeads()` query.

Ruled out:
- No CSP, CORS, or middleware blocking requests (no `middleware.ts`, no `headers()` config).
- No Supabase/RLS involved — this project uses Prisma + Neon Postgres directly with a trusted server-side connection, not an anon-key/RLS model.
- No user-agent, bot, or fraud-filtering logic anywhere in the codebase.
- The admin queries for leads (`getLeads()`) and sessions (`getSessions()`) in `lib/admin/queries.ts` are structurally symmetric — no special-casing that would make one appear and not the other.
- The recent "Harden Meta CAPI dedup" commit did not touch `app/api/leads/route.ts`.

Two concrete bugs were found and fixed:

## Fix 1 — server could silently drop a valid lead

**File:** `app/api/leads/route.ts`

Previously, the call to `upsertVisitorAndSession()` (which creates/updates the `Visitor` and `Session` rows tied to a lead) was not wrapped in error handling. If it threw anything other than a duplicate-key race (e.g. a transient database hiccup), the exception propagated unhandled out of the `POST` handler, Next.js returned a bare 500, and **the `Lead` row was never created** — even though the submitted name/phone were perfectly valid.

Since `visitorId`/`sessionId` are optional (nullable) fields on `Lead`, this coupling was unnecessary.

**Change:** wrapped the `upsertVisitorAndSession()` call in try/catch. A session-bookkeeping failure now just leaves `visitorId`/`sessionId` unset on the lead instead of aborting the whole request. The lead itself always gets saved as long as name/phone validate.

## Fix 2 — client silently swallowed all submission failures

**Files:** `components/LeadForm.tsx`, `components/QuickLeadForm.tsx`

The `catch` block around the lead form's `fetch("/api/leads", ...)` call caught every failure — network errors, non-2xx responses, JSON parse errors — and did nothing but show a generic "Something went wrong" message. No `console.error`, no tracking event, nothing sent to the server. This meant that if a submission was failing in the Meta in-app browser, there was **no record anywhere** of why.

**Change:** the catch block now:
1. Logs the error to the browser console.
2. Reports it via a new `trackError()` helper (`lib/tracking/track.ts`) into the existing error-tracking pipeline, tagged with a new error type `lead_submit`. This flushes immediately (via `sendBeacon`/fetch) rather than waiting for the periodic 5s tracking flush, so it isn't lost if the tab closes right after a failed submission.
3. These errors surface in the existing admin errors view (`/admin/errors`, backed by `getErrors()` in `lib/admin/queries.ts`) — same place JS errors and image-load failures already show up, filterable per-session too.

## What this does and doesn't guarantee

- If the root cause was the unhandled server-side exception (Fix 1), leads from the Meta in-app browser should now appear in the admin leads list going forward.
- If the root cause is something else — e.g. the in-app browser's `fetch` never completing due to a network/webview-level restriction — Fix 1 won't create a lead that never reached the server. But Fix 2 means the failure will now be visible in `/admin/errors` with a message and stack trace, instead of failing completely silently.
- Root cause was not reproduced directly (no way to launch the actual Facebook/Instagram in-app webview outside their apps from this environment). Confirmed via static analysis of the codebase (routes, queries, schema, tracking pipeline) plus code-level ruling out of CSP/CORS/RLS/bot-filtering causes.

## Suggested next step

Have someone submit a real lead from Instagram/Facebook's in-app browser on a phone. Either:
- The lead now appears in the admin leads list (Fix 1 was the cause), or
- It still fails, but the failure now appears in `/admin/errors` with enough detail (message + stack trace) to diagnose the actual remaining cause.

## Known related (not yet fixed) issue

`lib/tracking/ids.ts` — `getOrCreateVisitorId()`/`getOrCreateSessionId()` mint a brand-new random visitor/session ID on every call if `localStorage`/`sessionStorage` writes throw (documented in `docs/adding-utm-tracking.md` as a known behavior in Safari private mode and some in-app browsers). This doesn't cause leads to be dropped — the lead still gets saved — but it can cause a lead to be attached to a freshly-minted, mostly-empty session rather than the session that has the visitor's actual page-view/scroll/CTA history, making the lead harder to correlate with its session in the admin panel. Not fixed yet; flagged for a follow-up if it turns out to be relevant.
