# Prompt — Implement Meta Pixel + Conversions API (CAPI)

Paste everything below the line into a coding agent working in the target project. It is
self-contained: the agent does not need access to the repo this was extracted from.

---

## Task

Add Meta ads conversion tracking to this project: a **browser pixel** and a **server-side
Conversions API sender**, deduplicated against each other so Meta counts one conversion per
lead instead of two.

**Assumed project shape** (verify in step 0, adapt if different): Next.js App Router with
Prisma, a public landing page with a lead/contact form that POSTs to an API route, and an
`/admin` panel. If the stack differs, the contracts below still hold — payload shape, hashing
rules, and the dedup key are platform-independent — you are translating, not copying.

**In scope:** pixel snippet + `PageView` + `Lead`, CAPI `Lead` on lead creation, storage of
send status, and (if an admin panel exists) a manual re-send UI.

**Out of scope unless asked:** Marketing API / ad-account OAuth, spend and insights sync,
campaign reporting.

---

## Step 0 — Discovery. Do this before writing any code.

```bash
ls prisma/schema.prisma app/layout.tsx                       # App Router + Prisma?
grep -n "model Session\|model Lead\|model Visitor" prisma/schema.prisma
ls app/admin 2>/dev/null                                     # admin panel present?
grep -rn "fbq(\|fbevents\|connect.facebook.net" --include="*.ts*" . | grep -v node_modules
grep -rn "GTM-\|googletagmanager" --include="*.ts*" . | grep -v node_modules
rg -n "fbclid" prisma/schema.prisma app lib                  # is ad-click attribution captured?
```

Act on what you find:

- **`fbq` already appears** → stop and read it. You may be about to add a second pixel to a page
  that already has one. Resolve that before continuing.
- **A GTM container is installed** → assume it initializes its own pixel. This is the single most
  common cause of double-counted conversions. Ask the operator to audit the container for Meta
  tags, and use `trackSingle` (see invariant 2) regardless of what they find.
- **No `fbclid` capture anywhere** → conversions still work, but match quality will be poor. Note
  it in your report; capturing `fbclid`, `utm_*`, and the `_fbp`/`_fbc` cookies onto the session
  row is a prerequisite for good attribution and may need to be built first.
- **No `Lead`-equivalent model** → ask which server-side event marks a conversion here before
  proceeding. Everything below hangs off that row's id.

Read `node_modules/next/dist/docs/` for the installed Next.js version before writing components —
this project may be on a version whose APIs differ from what you remember.

---

## Step 1 — Environment variables

Add to `.env` / `.env.example` and to the host's env settings:

```bash
META_PIXEL_ID=                  # dataset id, server side
NEXT_PUBLIC_META_PIXEL_ID=      # same value, exposed to the browser
META_CAPI_ACCESS_TOKEN=         # Events Manager → Settings → Generate access token
META_GRAPH_API_VERSION=v21.0    # optional, defaults in code
META_CAPI_TEST_EVENT_CODE=      # ONLY while testing — see invariant 8
```

Two vars hold one pixel id on purpose: the server one must not be `NEXT_PUBLIC_`, and the browser
cannot read the server one. Both must be set, or half the integration silently no-ops.

`NEXT_PUBLIC_*` values are inlined at **build** time. Changing one requires a rebuild/redeploy, not
a restart. Every guard must treat an empty string as unset — `""` is falsy, so a plain
`if (!id) return` is correct, but `process.env.X !== undefined` is not.

**Human prerequisites** (state these in your report; you cannot do them): a Meta dataset/pixel
exists, a CAPI access token has been generated for it, and the domain is verified in Business
Manager.

---

## Step 2 — Schema

Add to the lead model (or equivalent conversion row):

```prisma
metaCapiSentAt DateTime?
metaCapiError  String?
```

Exactly one of these is meaningful at a time: a successful send sets `metaCapiSentAt` and clears
`metaCapiError`; a failure writes the error and leaves the timestamp alone. That pair is the only
record of whether Meta received the conversion — without it, a broken token is invisible.

Generate a migration; do not hand-edit generated client output.

---

## Step 3 — Browser pixel

Two files.

**`lib/meta/pixel.ts`** — helpers, importable from client components:

```ts
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function trackPixelPageView() {
  if (!META_PIXEL_ID) return;
  window.fbq?.("trackSingle", META_PIXEL_ID, "PageView");
}

/** `eventId` MUST be the conversion row's database id — the same value the
 *  server sender puts in `event_id`. See invariant 1. */
export function trackPixelLead(eventId: string) {
  if (!META_PIXEL_ID) return;
  window.fbq?.("trackSingle", META_PIXEL_ID, "Lead", {}, { eventID: eventId });
}
```

The `window.fbq?.` guards are load-order safety: the snippet defines `fbq` as a queueing stub, but
on admin routes (where the pixel is never mounted) it is genuinely undefined.

**`components/analytics/MetaPixel.tsx`** — a **client** component, not a bare `<Script>`, because
it has two jobs the server cannot do: skip `/admin`, and fire `PageView` on client-side navigation.

```tsx
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { META_PIXEL_ID, trackPixelPageView } from "@/lib/meta/pixel";

export function MetaPixel() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const enabled = Boolean(META_PIXEL_ID) && !isAdmin;

  // The inline snippet fires the first PageView itself, so ignore the pathname
  // this mounted on and report only subsequent navigations.
  const initialPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (initialPathRef.current === null) {
      initialPathRef.current = pathname;
      return;
    }
    if (initialPathRef.current === pathname) return;
    trackPixelPageView();
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('trackSingle','${META_PIXEL_ID}','PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" alt="" style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
```

Mount it once in `app/layout.tsx`. Rendering `null` when unconfigured means an environment without
the env var ships no snippet at all.

**Fire `Lead` from the form**, using the id the server returns:

```ts
const payload = await res.json();
if (payload?.leadId) trackPixelLead(payload.leadId);
```

The API route must return that id. If it currently returns `{ ok: true }`, change it.

---

## Step 4 — Conversions API

Split payload construction from sending. Put shared building in `lib/meta/capi-payload.ts` and the
network call in `lib/meta/capi.ts`; both start with `import "server-only"`. The split matters as
soon as anything else previews a payload (step 5) — one builder means the preview cannot drift
away from what is actually sent.

**Payload rules**, all mandatory:

- `event_time` is **unix seconds**, not milliseconds, and must be within the last 7 days.
- `action_source: "website"`.
- `event_id` = the conversion row's id (the dedup key).
- `user_data` must contain at least one identifier or Meta rejects the event.
- Hashed as SHA-256 hex, each as a **one-element array**: `em`, `ph`, `fn`, `ln`, `ct`, `st`,
  `zp`, `country`, `external_id`.
- Normalization before hashing: trim + lowercase for everything; strip all whitespace for names
  and locality fields; digits only for phone — **including the country code**, or the hash never
  matches anything.
- Sent **unhashed**: `client_ip_address`, `client_user_agent`, `fbc`, `fbp`.
- `fbc` format is `fb.1.<click_timestamp_ms>.<fbclid>`. If the click time was never captured, the
  row's creation time is the closest honest substitute — note the approximation in a comment.
- `custom_data.value` + `currency` together or not at all. `Purchase` requires both.
- Standard event names are case-sensitive: `Lead`, not `lead`.

```ts
export function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function eventsEndpoint(pixelId: string) {
  return `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || "v21.0"}/${pixelId}/events`;
}

export function buildLeadEventBody(lead: LeadWithSession, accessToken: string) {
  const userData: Record<string, unknown> = {};
  if (lead.email) userData.em = [sha256(lead.email)];
  if (lead.phone) userData.ph = [sha256(lead.phone.replace(/[^0-9]/g, ""))];
  if (lead.session?.ipAddress) userData.client_ip_address = lead.session.ipAddress;
  if (lead.session?.fbclid) userData.fbc = `fb.1.${lead.createdAt.getTime()}.${lead.session.fbclid}`;

  const body: Record<string, unknown> = {
    data: [{
      event_name: "Lead",
      event_time: Math.floor(lead.createdAt.getTime() / 1000),
      action_source: "website",
      event_id: lead.id,                       // pairs with the browser eventID
      user_data: userData,
      custom_data: { value: 0, currency: "INR", lead_source: lead.source ?? undefined },
    }],
    access_token: accessToken,
  };
  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
  }
  return body;
}
```

Set `currency` to the project's actual currency, and `value` to a real lead value if the business
has one.

**The sender** — `POST` the body, then record the outcome on the row:

- Return immediately if `META_PIXEL_ID` is unset; nothing to send to.
- No access token → write `metaCapiError` and return.
- Non-2xx → write `` `HTTP ${status}: ${text.slice(0, 500)}` `` to `metaCapiError` and return.
- Success → set `metaCapiSentAt`, clear `metaCapiError`.
- Wrap the whole thing in try/catch; the catch writes the message and swallows the throw.

**Wiring**: call it fire-and-forget from the lead route, after the row is created and inside the
platform's background-work primitive (on Vercel, `waitUntil` from `@vercel/functions`; elsewhere,
whatever keeps the promise alive after the response). Never `await` it in the request path and
never let it reject into the handler — a Meta outage must not cost the business a lead.

```ts
const lead = await prisma.lead.create({
  data: { /* … */ },
  include: { session: { select: { fbclid: true, ipAddress: true } } },
});

waitUntil(sendLeadConversionEvent(lead));

return NextResponse.json({ ok: true, leadId: lead.id });
```

---

## Step 5 — Admin re-send (only if an admin panel exists)

Worth building: automatic sends fail silently at exactly the moments you care about, and offline
conversions (a lead that closed on the phone) have no other route into Meta.

- Show `metaCapiSentAt` / `metaCapiError` as a status badge in the leads table.
- A modal per lead: pick an event type (`Lead`, `Purchase`, `Subscribe`,
  `CompleteRegistration`, `StartTrial`, or a custom name matching `^[A-Za-z0-9_]{1,50}$`),
  optional value + currency, optional order/reference id, **preview the exact JSON**, then send.
- The preview must come from the same builder as the live send, with `access_token` replaced by
  the literal `<ACCESS_TOKEN>`. A preview built by separate code is a preview that lies.
- The client sends **only** a row id plus the operator's choices. Email, phone, IP, `fbclid`, and
  location are re-read server-side. The browser must never be able to dictate whose data reaches
  Meta.
- `event_time` for a manual send is **now**, not the row's creation time — the conversion happened
  when the operator says it did, and most rows worth converting by hand are older than 7 days.
- `event_id` = the order id when given, else the row id, so re-sending the same event type
  collapses into one conversion instead of double-counting.
- Surface Meta's `fbtrace_id` and `events_received` from the response; they are what makes a
  delivery findable in Events Manager.
- Emit warnings alongside the preview: empty `user_data`, blank `event_id`, a phone with no
  country code, missing `fbc`/`fbp`, `event_time` older than 7 days, `Purchase` without a value.
- Constants shared with a client component (event-type list, name pattern) go in their own module —
  a `server-only` file cannot be imported from `"use client"` code.
- Outside production, when credentials are absent, returning a fake `evt_preview_…` success without
  touching the row lets the whole flow be reviewed before Meta credentials exist. In production,
  return the missing-credentials error instead.

---

## Non-negotiable invariants

1. **Dedup.** Browser `eventID` (capital ID) and server `event_id` carry the same value — the
   conversion row's database id — for the same conversion. Diverge and every lead counts twice.
2. **`trackSingle`, never `track`.** `fbq("track", …)` broadcasts to *every* pixel initialized on
   the page. If a GTM container initializes a second one, plain `track` silently writes this
   site's conversions into someone else's dataset. `trackSingle` pins each call to one pixel id.
3. **The access token never reaches the browser.** No `NEXT_PUBLIC_` token, no token in a preview
   payload, no token in a client component or a server-action return value.
4. **A CAPI failure never fails the conversion.** Fire-and-forget, try/catch, error recorded on
   the row.
5. **The client never supplies identity.** Server actions and API routes accept a row id and
   operator choices only; PII is re-read from the database.
6. **`event_time` is unix seconds and within 7 days.**
7. **Hash the country code into the phone number.** The most common cause of low match quality.
8. **`META_CAPI_TEST_EVENT_CODE` is unset in production.** Left set, every real lead lands in the
   test panel and counts as zero conversions. This is the most common way a working setup produces
   nothing.
9. **No unused exported server actions.** An exported action is a live POST endpoint whether or
   not anything calls it; delete what you replace.

---

## Verification — run in order, each isolates one link

1. **Token works.** Set `META_CAPI_TEST_EVENT_CODE` to the **Website** channel's code and POST a
   hand-built `Lead` to `https://graph.facebook.com/v21.0/<PIXEL_ID>/events` with a hashed test
   email. Expect `{"events_received":1,"messages":[],"fbtrace_id":"…"}`. Anything in `messages` is
   worth reading. A `(#100) Missing Permission` on a *read* is normal — CAPI tokens are
   write-scoped; only a POST proves the token.
2. **Visible.** Events Manager → Test events → **Website** channel → the event appears, source
   **Server**. `events_received: 1` with nothing shown almost always means the wrong channel's
   test code.
3. **Pixel live.** Restart the dev server (env is read at boot). Load the site → `PageView`,
   source **Browser**. Navigate client-side → a second `PageView`. Load `/admin` → nothing.
4. **Dedup holds.** Submit the form. Expect **exactly one** `Lead` showing both Browser and Server
   with identical event IDs. Two rows with the same id → the ids are not actually matching. A
   third `Lead` with **no** event ID → a second pixel is on the page, almost always GTM.
5. **Recorded.** The row has `metaCapiSentAt` set and `metaCapiError` null.
6. **Rollout.** Clear the test event code, set env on the host, redeploy (`NEXT_PUBLIC_*` is
   baked in at build), remove competing Meta tags from GTM, then confirm on the live domain. After
   a day of real traffic, check Event Match Quality on the `Lead` event — below ~6 means the
   identifiers are too thin.

---

## Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Nothing sent, no error recorded | Env var is `""` — falsy, guard returns early | Check for empty strings |
| Leads counted twice | A second pixel firing `Lead` with no `eventID` | Remove the GTM tag; `trackSingle` |
| Conversions land in a *different* dataset | `fbq('track')` broadcasting | `trackSingle` with explicit id |
| Test events never appear despite `events_received: 1` | Offline channel code used for a `website` event | Use the Website channel's code |
| Overview tab empty while testing | Correct — test events are excluded from dataset metrics | Watch the Test events tab |
| Low Event Match Quality | Phone missing country code; no `fbc`/`fbp` | Step 4 payload rules |
| Event rejected as too old | `event_time` > 7 days | Send at conversion time; manual sends use *now* |
| Pixel missing in production | `NEXT_PUBLIC_*` absent at build time | Set on host, redeploy |
| Only the first page counted | `PageView` not re-fired on client-side nav | The route-change effect in step 3 |
| Admin traffic in the data | Pixel mounted on admin routes | The `/admin` guard in step 3 |
| Zero conversions in production, all healthy locally | Test event code still set | Invariant 8 |

---

## Definition of done

Report back with: files added/changed; the migration name; which env vars the operator still has
to fill in; the verification steps you actually ran versus the ones that need Meta credentials or
a deploy; and anything you found in step 0 that weakens the integration (an existing pixel, a GTM
container, missing `fbclid` capture). Do not report the integration as working on the strength of
code that compiles — a `Lead` that shows Browser + Server on one row in Test events is the only
proof that matters.

---

## Reference — a complete `Lead` event

```json
{
  "data": [
    {
      "event_name": "Lead",
      "event_time": 1754300000,
      "action_source": "website",
      "event_id": "cmseizfrq001pldm9kmr3r7i1",
      "event_source_url": "https://example.com/contact",
      "user_data": {
        "em": ["b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514"],
        "ph": ["e7d3685e04dbbea78c8b0e37b1e8c5e33e0e8dbb04b8c9d2e6f5a3b1c0d9e8f7"],
        "fn": ["…"], "ln": ["…"], "ct": ["…"], "st": ["…"], "country": ["…"],
        "external_id": ["…"],
        "client_ip_address": "49.36.1.1",
        "client_user_agent": "Mozilla/5.0 …",
        "fbc": "fb.1.1754200000000.IwAR2xY…",
        "fbp": "fb.1.1754199000000.1234567890"
      },
      "custom_data": { "value": 0, "currency": "INR", "lead_source": "meta" }
    }
  ],
  "access_token": "EAA…",
  "test_event_code": "TEST12345"
}
```

Up to 1000 events per `data` array.
