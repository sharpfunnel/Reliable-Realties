# Meta Ads Integration — Build Guide

**Audience: an AI agent implementing this in a project that does not have it yet.**

This guide is self-contained. You do not need access to the repo it was extracted from — every
piece of code you need is inline.

**Target project shape.** Written for a Next.js App Router (16.x) project using Prisma, with a
landing page, a lead form, and an admin panel. Section 1 has a discovery step to confirm that
before you write anything. If the project is a different stack, the contracts in Parts B and C
still hold — the payload shape, the hashing rules and the dedup key are platform-independent —
but you will be translating rather than copying.

---

## 0. What you are building

Meta ads work as a feedback loop. Break any link and the ones after it degrade:

```
  ①  Someone clicks your ad
      ↓   lands with ?fbclid=…&utm_campaign=…&ad_id=…
  ②  Capture who they are and where they came from      → Part A
      ↓   stored on the Session row
  ③  They convert → tell Meta the click paid off        → Parts B + C
      ↓   browser pixel + server CAPI, deduplicated
  ④  Meta optimises; pull spend and results back        → Part D
      ↺   you decide what to scale
```

| Part | What it does | Prerequisite | Stop here if… |
|---|---|---|---|
| **A** | Capture click IDs, UTMs, ad hierarchy onto sessions | A session/visitor tracker | — |
| **B** | Browser pixel: `PageView`, `Lead` | A | you have no server |
| **C** | Conversions API: server-side `Lead` | A | you have no admin panel |
| **D** | OAuth + insights sync + campaign reporting | A, C | you only need conversion tracking |

Parts B and C are the ones that make ads cheaper. Part D is reporting — valuable, but nothing
breaks without it.

---

## 1. Discovery — run this before writing any code

### 1.1 Confirm the project shape

```bash
ls prisma/schema.prisma app/layout.tsx                 # Next App Router + Prisma?
grep -n "model Session\|model Lead\|model Visitor" prisma/schema.prisma
ls app/admin 2>/dev/null                               # admin panel present?
grep -rn "fbq(\|fbevents\|connect.facebook.net" --include="*.ts*" . | grep -v node_modules
grep -rn "GTM-\|googletagmanager" --include="*.ts*" . | grep -v node_modules
```

If `model Session` does not exist, Part A is a larger job than this guide covers — you need
visitor/session tracking first. If `fbq` already appears in the codebase, stop and read it; you
may be adding a second pixel to a page that already has one.

### 1.2 Audit the GTM container — do this FIRST

**This is the step most likely to be skipped and most likely to cause a silent, expensive bug.**

Marketing teams frequently install a Meta Pixel through Google Tag Manager years before a
developer is asked to "add the pixel". You will not find it by grepping the codebase — it lives
in a remote container config. If you install a second pixel without knowing, every conversion is
recorded twice and you will not notice until the numbers are already wrong.

If the project has a GTM container ID, dump the container and look:

```bash
node -e '
fetch("https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXXX")
  .then(r => r.text())
  .then(t => {
    console.log("facebook refs:", (t.match(/connect\.facebook\.net|fbevents|fbq/g) || []).length);
    console.log("pixel ids:", [...new Set(t.match(/fbq\(.{0,10}init.{0,10}[0-9]{15,16}/g) || [])]);
    console.log("events:", [...new Set(t.match(/fbq\([^)]{0,80}\)/g) || [])]);
  });
'
```

Report what you find to the human before proceeding. If a pixel is already there:

- Ask which pixel their live campaigns optimise against. That one has the conversion history and
  is usually the one to keep — creating a fresh dataset resets learning to zero.
- Any GTM tag firing `Lead` must be removed. It cannot carry the dedup key (see §5.1), so it will
  double-count every conversion alongside your server events.
- Engagement tags (`Scroll90`, `CTAClick`, `TimeOnPage30s`) are harmless and worth keeping if the
  team runs retargeting — but see §4.3, because they interact badly with a second pixel.

---

## 2. Meta-side setup (a human must do this)

You cannot automate these steps. Give the human this list and wait.

### 2.1 Dataset and access token

1. [Events Manager](https://business.facebook.com/events_manager2) → **Connect data sources** →
   **Web** → create a dataset (or reuse the one identified in §1.2).
2. Copy the **Dataset ID** — 15–16 digits. This is the "pixel ID".
3. **Settings** → **Conversions API** → **Generate access token**. Copy it.
4. **Test events** tab → select the **Website** channel → copy the test code.

> **Test event codes are per-channel.** The Website and Offline tabs show *different* codes. An
> event with `action_source: "website"` sent with the Offline code will be accepted by the API and
> then never appear in the feed you are watching. This wastes a lot of time.

Decline any prompt to "connect your Google Tag Manager account" or use a partner integration.
Those flows request permission to publish container versions and manage container users — far more
access than installing a snippet requires, and you are writing the code anyway.

### 2.2 Developer app — only if you are doing Part D

1. [developers.facebook.com](https://developers.facebook.com) → create a **Business** app.
2. Add the **Facebook Login** product; set the redirect URI to
   `https://yourdomain.com/api/meta/oauth/callback` (and the localhost equivalent for dev).
3. Note the App ID and App Secret.
4. Required scopes: `ads_read`, `ads_management`, `business_management`.

### 2.3 Environment variables

```bash
# --- Parts B & C: conversion tracking ---
META_PIXEL_ID="1234567890123456"              # server-side
NEXT_PUBLIC_META_PIXEL_ID="1234567890123456"  # same value, exposed to the browser
META_CAPI_ACCESS_TOKEN="EAA..."               # SECRET — never NEXT_PUBLIC_
META_CAPI_TEST_EVENT_CODE=""                  # testing only; MUST be empty in production
META_GRAPH_API_VERSION="v21.0"
NEXT_PUBLIC_SITE_URL="https://example.com"    # used to build event_source_url

# --- Part D: ad account sync ---
META_APP_ID=""
META_APP_SECRET=""                            # SECRET
META_REDIRECT_URI="http://localhost:3000/api/meta/oauth/callback"
CRON_SECRET=""                                # SECRET — guards the sync route
```

The pixel ID appears twice deliberately: the browser snippet needs it exposed, the server sender
does not, and you never want a habit of prefixing secrets with `NEXT_PUBLIC_`.

> **An empty string is not "unset" in a useful way.** `META_PIXEL_ID=""` is falsy, so the sender's
> guard clause returns early — sending nothing, and recording no error. The system looks healthy
> and does nothing. When debugging "no events", check for empty strings before anything else.

---

## 3. Part A — Attribution capture

**Skip this section if the project already stores `fbclid` and UTM params on its session rows.**

Without this, CAPI has nothing to match on beyond email and phone, and match quality stays poor.

### 3.1 Schema

```prisma
model Session {
  // … existing fields …
  entryPath      String?
  referrer       String?
  utmSource      String?
  utmMedium      String?
  utmCampaign    String?
  utmContent     String?
  utmTerm        String?
  gclid          String?
  fbclid         String?
  msclkid        String?
  placement      String?   // Meta dynamic param {{placement}}
  metaCampaignId String?   // {{campaign.id}}
  metaAdsetId    String?   // {{adset.id}}
  metaAdId       String?   // {{ad.id}}
  fbc            String?   // _fbc cookie, read server-side — see §3.4
  fbp            String?   // _fbp cookie, read server-side — see §3.4
  rawParams      Json?     // catch-all: every landing-URL query param
  ipAddress      String?
  userAgent      String?   // sent unhashed as client_user_agent — a real match signal
}

model Lead {
  // … existing fields …
  metaCapiSentAt DateTime?
  metaCapiError  String?
}
```

`rawParams` matters more than it looks. Ad platforms add parameters faster than you will add
columns; storing the raw set means a question asked in six months ("did that campaign use
`utm_id`?") is answerable from data you already have.

For the ad hierarchy fields to be populated, the human must append Meta's dynamic parameters to
the ad's destination URL:

```
?utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}
&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}
```

### 3.2 Client capture — cache once per session

**The critical rule: read acquisition params once, on the landing page, and cache them.** A
visitor lands on `/?utm_source=meta&fbclid=…`, clicks through to `/about` which has no query
string, and the next beacon flush overwrites their attribution with blanks. Every lead then looks
like direct traffic.

`lib/track/client/acquisition.ts`:

```ts
"use client";

const SESSION_META_KEY = "acq_meta";

export type SessionEntryMeta = {
  entryPath: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  placement?: string;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaAdId?: string;
  rawParams: Record<string, string>;
};

function getOrCreateEntryMeta(): SessionEntryMeta {
  try {
    const cached = sessionStorage.getItem(SESSION_META_KEY);
    if (cached) return JSON.parse(cached) as SessionEntryMeta;
  } catch {
    // storage unreadable (Safari private mode, in-app webviews) — read fresh
  }

  const params = new URLSearchParams(window.location.search);
  const param = (key: string) => params.get(key) ?? undefined;

  const meta: SessionEntryMeta = {
    entryPath: window.location.pathname,
    referrer: document.referrer || undefined,
    utmSource: param("utm_source"),
    utmMedium: param("utm_medium"),
    utmCampaign: param("utm_campaign"),
    utmContent: param("utm_content"),
    utmTerm: param("utm_term"),
    gclid: param("gclid"),
    fbclid: param("fbclid"),
    msclkid: param("msclkid"),
    placement: param("placement"),
    metaCampaignId: param("campaign_id"),
    metaAdsetId: param("adset_id"),
    metaAdId: param("ad_id"),
    rawParams: Object.fromEntries(params.entries()),
  };

  try {
    sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
  } catch {
    // fail open: this payload still carries the attribution, we just can't cache it
  }

  return meta;
}

export function getSessionInit() {
  return {
    ...getOrCreateEntryMeta(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}
```

### 3.3 Server ingestion

Sanitise `rawParams` — it arrives straight off the wire into a JSON column:

```ts
const MAX_RAW_PARAMS = 50;
const MAX_RAW_PARAM_LENGTH = 500;

export function sanitizeRawParams(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .slice(0, MAX_RAW_PARAMS)
    .map(([key, val]) => [key.slice(0, MAX_RAW_PARAM_LENGTH), val.slice(0, MAX_RAW_PARAM_LENGTH)]);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
```

Two details worth copying:

- Write `undefined` rather than `{}` when there are no params, so direct-traffic sessions leave the
  column NULL instead of storing an empty object on every row.
- **Every route that creates a session must map every field.** If the lead form's endpoint creates
  sessions independently of the beacon endpoint, and only one of them maps `metaAdId`, attribution
  silently depends on which one fires first.

### 3.4 Capture the Meta cookies — do this properly

The pixel writes two first-party cookies on your domain: `_fbp` (browser identifier) and `_fbc`
(derived from `fbclid` at click time). They are the **strongest matching signals available** —
deterministic click identifiers, not probabilistic guesses from a hashed email.

Because they are first-party, your server can simply read them off the request:

```ts
export function readMetaCookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const jar = Object.fromEntries(
    header.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, rest.join("=")];
    }),
  );
  return { fbp: jar._fbp || undefined, fbc: jar._fbc || undefined };
}
```

Store both on the session when the lead is created, and prefer them over anything synthesised.

> **Why this matters more than it looks.** The obvious shortcut is to rebuild `fbc` from a stored
> `fbclid` as `fb.1.${Date.now()}.${fbclid}` at send time. That timestamp is supposed to be *when
> the click happened*, and a lead submitted three days after the click will carry a value three
> days wrong. Reading the real cookie avoids the problem entirely. If you must synthesise — no
> pixel on the page, or the cookie is missing — use the session's `startedAt`, never the send time.

---

## 4. Part B — Browser pixel

### 4.1 The helper module

`lib/meta/pixel.ts`:

```ts
/**
 * Browser-side Meta Pixel helpers.
 *
 * The snippet defines `window.fbq` as a stub that queues calls until
 * fbevents.js loads, so these are safe to call as soon as the snippet has run.
 * Before that — and on /admin, where the pixel is never mounted — `fbq` is
 * undefined, hence the optional calls.
 */

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

/**
 * Fires the browser half of a Lead conversion.
 *
 * `eventId` MUST be the lead row's database id — the same value the server
 * sender puts in `event_id`. Meta collapses the two into one conversion when
 * the pair matches; if they diverge, every lead is counted twice.
 */
export function trackPixelLead(eventId: string) {
  if (!META_PIXEL_ID) return;
  window.fbq?.("trackSingle", META_PIXEL_ID, "Lead", {}, { eventID: eventId });
}
```

### 4.2 The component

`components/analytics/MetaPixel.tsx`:

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

  // The snippet fires the first PageView itself, so the effect must ignore the
  // pathname it mounted on and report only subsequent navigations.
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
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
```

Three behaviours, each earning its complexity:

1. **Skips `/admin`** — operator activity is not visitor activity, and you do not want your own
   team's browsing shaping ad optimisation.
2. **Fires `PageView` on route change** — the inline snippet runs once per document. Without the
   effect, every client-side navigation after the first goes uncounted.
3. **Renders nothing when unconfigured** — an environment without the env var ships no snippet at
   all, rather than a broken one.

Mount it in the root layout, `app/layout.tsx`:

```tsx
<body>
  {children}
  <MetaPixel />
</body>
```

### 4.3 `trackSingle`, not `track` — the highest-value line in this guide

`fbq('track', …)` broadcasts to **every pixel initialised on the page**. If GTM has quietly
initialised another pixel (see §1.2), a plain `track` writes your conversions into someone else's
dataset — often a different client's, at an agency. `trackSingle` pins each call to your pixel ID.

This protects events leaving *your* code. It does **not** stop a GTM tag broadcasting into *your*
dataset — that only stops when the tag is removed from the container.

### 4.4 Fire `Lead` from the form

In the form's success branch, using the id returned by your API:

```tsx
const payload = (await res.json().catch(() => null)) as
  | { leadId?: string; error?: string }
  | null;

if (!res.ok) throw new Error(payload?.error ?? "Submission failed");

// Browser half of the conversion. The lead id doubles as the eventID, pairing
// this with the server-side CAPI event so Meta counts one conversion, not two.
if (payload?.leadId) trackPixelLead(payload.leadId);
```

This requires the API route to return the created lead's id. If it currently returns `{ ok: true }`,
change it.

---

## 5. Part C — Conversions API

### 5.1 The deduplication contract

> **The browser's `eventID` and the server's `event_id` must both be the lead row's database id.**

Everything else in this section is detail. Get this wrong and you have built a double-counter.
Meta collapses the two reports into one conversion when `event_name` and the event ID both match,
within roughly a 48-hour window.

A database primary key is the ideal value: unique, already generated at exactly the moment both
halves need it, and stable if you re-send later.

### 5.2 Payload construction

Keep this in its own module. The live sender, any admin preview tool, and any manual send must all
build payloads *here* — if a preview screen builds its own JSON, it will drift from what actually
ships and start lying to whoever trusts it.

`lib/meta/capi-payload.ts`:

```ts
import "server-only";
import { createHash } from "node:crypto";

export function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || "v21.0";
}

export function eventsEndpoint(pixelId: string) {
  return `https://graph.facebook.com/${graphVersion()}/${pixelId}/events`;
}

/** Meta's rule: normalise first, then SHA-256 the result. */
export function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Lowercase, trim, strip all whitespace — for names, city, state, zip, country. */
function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Normalises a phone number to E.164 digits, WITH country code and without '+'.
 *
 * This is not cosmetic. Meta matches on the full international number, so a
 * 10-digit local number hashes to a value that can never match any record they
 * hold — the event is accepted, contributes nothing, and quietly drags down
 * Event Match Quality. Pass the market's country code as `defaultCountryCode`
 * ("91" India, "1" US/Canada, "44" UK).
 *
 * Heuristic by design; use libphonenumber-js if you serve multiple countries.
 */
export function normalizePhone(raw: string, defaultCountryCode: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);                    // 00<cc> international prefix
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);                    // national trunk prefix
  }

  if (digits.length <= 10) {
    digits = `${defaultCountryCode}${digits}`;   // no country code present
  }

  return digits;
}

/**
 * Builds `fbc`. Prefer the real _fbc cookie; it already carries the true click
 * timestamp. Only synthesise when the cookie is absent, and anchor it to when
 * the session started — never to now, which would be wrong by however long the
 * visitor took to convert.
 */
export function buildFbc(
  cookieFbc: string | null | undefined,
  fbclid: string | null | undefined,
  sessionStartedAt: Date | null | undefined,
): string | undefined {
  if (cookieFbc) return cookieFbc;
  if (!fbclid) return undefined;
  return `fb.1.${(sessionStartedAt ?? new Date()).getTime()}.${fbclid}`;
}

export type LeadWithSession = {
  id: string;
  createdAt: Date;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  session?: {
    startedAt: Date;
    fbclid: string | null;
    fbc: string | null;
    fbp: string | null;
    ipAddress: string | null;
    userAgent?: string | null;
    entryPath: string | null;
  } | null;
  visitor?: { city: string | null; region: string | null; country: string | null } | null;
};

export function buildLeadEventBody(
  lead: LeadWithSession,
  accessToken: string,
  opts: { defaultCountryCode: string; siteUrl?: string },
) {
  const userData: Record<string, unknown> = {};

  if (lead.email) userData.em = [sha256(lead.email)];

  if (lead.phone) {
    const phone = normalizePhone(lead.phone, opts.defaultCountryCode);
    if (phone) userData.ph = [sha256(phone)];
  }

  const [firstName, ...rest] = (lead.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (firstName) userData.fn = [sha256(normalizeText(firstName))];
  if (rest.length) userData.ln = [sha256(normalizeText(rest.join(" ")))];

  if (lead.visitor?.city) userData.ct = [sha256(normalizeText(lead.visitor.city))];
  if (lead.visitor?.region) userData.st = [sha256(normalizeText(lead.visitor.region))];
  if (lead.visitor?.country) userData.country = [sha256(normalizeText(lead.visitor.country))];

  // Stable per-person id. Hashed like the rest; lets Meta join repeat conversions.
  userData.external_id = [sha256(lead.id)];

  // Sent UNHASHED, per Meta's spec — these are not PII in Meta's model.
  if (lead.session?.ipAddress) userData.client_ip_address = lead.session.ipAddress;
  if (lead.session?.userAgent) userData.client_user_agent = lead.session.userAgent;
  if (lead.session?.fbp) userData.fbp = lead.session.fbp;

  const fbc = buildFbc(lead.session?.fbc, lead.session?.fbclid, lead.session?.startedAt);
  if (fbc) userData.fbc = fbc;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(lead.createdAt.getTime() / 1000),
        action_source: "website",
        event_id: lead.id, // ← the dedup key; must equal the browser's eventID
        event_source_url: opts.siteUrl && lead.session?.entryPath
          ? `${opts.siteUrl}${lead.session.entryPath}`
          : undefined,
        user_data: userData,
        custom_data: {
          value: 0,
          currency: "INR",
          lead_source: lead.source ?? undefined,
        },
      },
    ],
    access_token: accessToken,
  };

  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
  }

  return body;
}
```

Normalisation rules, in one place:

| Field | Key | Normalise | Hash? |
|---|---|---|---|
| Email | `em` | trim, lowercase | yes |
| Phone | `ph` | digits only, **with country code** | yes |
| First / last name | `fn` / `ln` | lowercase, strip whitespace | yes |
| City / state / zip | `ct` / `st` / `zp` | lowercase, strip whitespace | yes |
| Country | `country` | ISO-2, lowercase | yes |
| Your user id | `external_id` | trim, lowercase | yes |
| IP address | `client_ip_address` | — | **no** |
| User agent | `client_user_agent` | — | **no** |
| Click / browser id | `fbc` / `fbp` | — | **no** |

### 5.3 The sender

`lib/meta/capi.ts`:

```ts
import "server-only";

import { prisma } from "@/lib/db";
import { buildLeadEventBody, eventsEndpoint, type LeadWithSession } from "@/lib/meta/capi-payload";

/**
 * Sends a server-side "Lead" event for a newly created Lead row.
 *
 * A CAPI failure must NEVER fail the lead submission — the visitor's form
 * succeeded, and an ad-reporting problem is not their problem. Callers invoke
 * this fire-and-forget; every failure path records itself on the row instead.
 */
export async function sendLeadConversionEvent(lead: LeadWithSession) {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return;

  try {
    const body = buildLeadEventBody(lead, accessToken, {
      defaultCountryCode: "91",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });

    const res = await fetch(eventsEndpoint(pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      await prisma.lead.update({
        where: { id: lead.id },
        data: { metaCapiError: `HTTP ${res.status}: ${text.slice(0, 500)}` },
      });
      return;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { metaCapiSentAt: new Date(), metaCapiError: null },
    });
  } catch (error) {
    await prisma.lead
      .update({
        where: { id: lead.id },
        data: { metaCapiError: error instanceof Error ? error.message : "Unknown CAPI error" },
      })
      .catch(() => {});
  }
}
```

Recording outcomes on the row is what makes this debuggable later. "Meta shows fewer conversions
than we have leads" is answerable in one query instead of a support ticket.

### 5.4 Wire it into the lead route

```ts
import { waitUntil } from "@vercel/functions";

const lead = await prisma.lead.create({
  data: { /* … */ },
  include: {
    session: {
      select: {
        startedAt: true, fbclid: true, fbc: true, fbp: true,
        ipAddress: true, entryPath: true,
      },
    },
    visitor: { select: { city: true, region: true, country: true } },
  },
});

waitUntil(sendLeadConversionEvent(lead));

return NextResponse.json({ ok: true, leadId: lead.id });
```

`waitUntil` lets the response return immediately while the request to Meta completes in the
background. Without it on a serverless platform, the function may be frozen before the fetch
finishes. Outside Vercel, use the equivalent (`event.waitUntil`, a queue, or a detached promise
with a logged `.catch()`).

Note `leadId` in the response — Part B needs it.

### 5.5 Optional: an admin console

Worth building once you are past initial setup. Two screens, both cheap if §5.2 is a shared module:

- **Dry-run composer** — pick an event type, fill in user data, see the exact JSON that *would* be
  sent, plus a raw → normalised → SHA-256 table per field. Performs no network I/O; renders
  `access_token` as a placeholder so the secret never reaches the browser. Invaluable for
  answering "why doesn't this lead match?"
- **Delivery log** — a table of `metaCapiSentAt` / `metaCapiError` per lead, and a manual send
  button for hand-firing a conversion (a deal that closed offline, say).

Two rules if you build them:

1. Build the preview with the **same function** the live sender uses. A separate preview path will
   drift and become actively misleading.
2. The client sends only a lead id plus the operator's choices. Re-read email, phone, IP and
   `fbclid` server-side — never let the browser dictate whose data goes to Meta.

Useful warnings to surface in a composer: empty `user_data`; blank `event_id`; a phone with no
country code; no `fbc`/`fbp`; `event_time` older than 7 days; `Purchase` without `value` +
`currency`.

---

## 6. Part D — Ad account sync and reporting

Parts A–C push data *to* Meta. This pulls spend and performance *back*, so the admin panel can
show cost per lead computed from leads that actually exist in your database.

### 6.1 Schema

```prisma
model MetaAdAccount {
  id             String     @id @default(cuid())
  accountId      String     @unique   // Meta's "act_…" id
  name           String?
  currency       String?
  timezoneName   String?
  accessToken    String?              // null = disconnected
  tokenExpiresAt DateTime?
  connectedAt    DateTime   @default(now())
  lastSyncedAt   DateTime?
  lastSyncError  String?
  campaigns      Campaign[]
}

model Campaign {
  id             String        @id @default(cuid())
  adAccountId    String
  adAccount      MetaAdAccount @relation(fields: [adAccountId], references: [id])
  metaId         String        @unique
  name           String
  status         String?
  objective      String?
  dailyBudget    Float?
  lifetimeBudget Float?
  startTime      DateTime?
  stopTime       DateTime?
  adSets         AdSet[]
  insights       MetaInsight[]
}

// AdSet: campaignId, metaId @unique, name, status, budgets, optimizationGoal,
//        billingEvent, targeting Json?
// Ad:    adSetId,   metaId @unique, name, status, creativeId, headline,
//        bodyText, thumbnailUrl, linkUrl

model MetaInsight {
  id               String    @id @default(cuid())
  level            String    // campaign | adset | ad
  entityId         String
  date             DateTime
  campaignId       String?
  adSetId          String?
  adId             String?
  spend            Float?
  impressions      Int?
  reach            Int?
  clicks           Int?
  linkClicks       Int?
  landingPageViews Int?
  ctr              Float?
  cpc              Float?
  cpm              Float?
  frequency        Float?
  results          Int?
  costPerResult    Float?

  @@unique([level, entityId, date])   // makes re-syncs idempotent
  @@index([date])
}
```

The unique triple is the important part: sync the same date range twice and rows update rather
than duplicate.

### 6.2 OAuth

Two routes, both admin-authenticated:

**`/api/meta/oauth/start`** — generate a random `state`, store it in an httpOnly cookie
(10-minute max age), redirect to:

```
https://www.facebook.com/{version}/dialog/oauth
  ?client_id={META_APP_ID}
  &redirect_uri={META_REDIRECT_URI}
  &state={state}
  &scope=ads_read,ads_management,business_management
```

**`/api/meta/oauth/callback`** — verify `state` against the cookie (this is the CSRF defence; do
not skip it), then exchange the code for a token, twice:

```ts
// 1. code → short-lived token
GET /oauth/access_token?client_id=…&client_secret=…&redirect_uri=…&code=…

// 2. short-lived → long-lived (~60 days)
GET /oauth/access_token?grant_type=fb_exchange_token&client_id=…&client_secret=…
    &fb_exchange_token={shortLived}
```

Store the long-lived token and its expiry on `MetaAdAccount`, then fetch `/me/adaccounts` to
create the account rows.

### 6.3 Sync

```
for each connected MetaAdAccount:
  if tokenExpiresAt is within 7 days → refresh via fb_exchange_token, persist
  fetch /{act_id}/campaigns  → upsert on metaId
  fetch /{campaign}/adsets   → upsert
  fetch /{adset}/ads         → upsert
  fetch insights at each level, date_preset last_30d, time_increment=1
                             → upsert on [level, entityId, date]
  record lastSyncedAt / lastSyncError
```

Insights fields worth requesting: `spend`, `impressions`, `reach`, `clicks`,
`inline_link_clicks`, `ctr`, `cpc`, `cpm`, `frequency`, `actions`. Lead counts come out of
`actions` where `action_type === "lead"`; landing page views from `landing_page_view`.
Derive `costPerResult` as `spend / results` rather than trusting a returned field.

Expose sync two ways: a button in the admin panel, and a cron route guarded by a bearer secret.

```ts
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await syncAllMetaAdAccounts()) });
}
```

On Vercel, schedule it in `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/meta-sync", "schedule": "0 */6 * * *" }] }
```

If that block is missing, sync is manual-button-only. Check for it before telling anyone the data
is up to date.

### 6.4 The query that makes this worth building

Join Meta's spend against **your own** lead count, matched on `session.metaCampaignId`:

```ts
// Per campaign, over the window:
//   spend, impressions, clicks       ← MetaInsight (Meta's numbers)
//   sessions                         ← count of Sessions with that metaCampaignId
//   onSiteLeads                      ← count of Leads whose session has it
//   trueCostPerLead = spend / onSiteLeads
```

Fall back to matching on `utmCampaign` by name for sessions captured before the ad hierarchy
params were added.

The point is having two independent numbers side by side. Meta reports conversions it attributed —
including view-through and cross-device. Your database reports rows that exist. They will disagree.
When deciding what to scale, the second one is the one you can defend.

---

## 7. Verification

Run in order. Each step isolates one link in the chain.

**1. Does the token work?** Set `META_CAPI_TEST_EVENT_CODE` to the **Website** channel code, then:

```bash
node -e '
const fs=require("fs"),crypto=require("crypto");
const env=Object.fromEntries(fs.readFileSync(".env","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.trim().startsWith("#"))
  .map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),
    l.slice(i+1).trim().replace(/^["\x27]|["\x27]$/g,"")]}));
const sha=v=>crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
const body={data:[{event_name:"Lead",event_time:Math.floor(Date.now()/1000),
  action_source:"website",event_id:"smoke-test-1",
  user_data:{em:[sha("test@example.com")],ph:[sha("919999999999")],
  client_ip_address:"49.36.1.1"},
  custom_data:{value:0,currency:"INR"}}],
  access_token:env.META_CAPI_ACCESS_TOKEN,
  test_event_code:env.META_CAPI_TEST_EVENT_CODE};
fetch(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION||"v21.0"}/${env.META_PIXEL_ID}/events`,
  {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
  .then(r=>r.text()).then(t=>console.log(t));
'
```

Expect `{"events_received":1,"messages":[],"fbtrace_id":"…"}`. Anything in `messages` is a
warning worth reading.

**2. Is it visible?** Test events tab, **Website** channel, panel open → the event appears, source
**Server**. If the API said `events_received: 1` and nothing shows, you are almost certainly using
the wrong channel's test code.

**3. Is the pixel live?** Restart the dev server — env vars are read at boot, so a running process
still holds the old values. Load the site → `PageView` appears, source **Browser**.

**4. Does dedup hold?** Submit the form. Expect **exactly one** `Lead` showing both Browser and
Server, with identical Event IDs.

- Two separate `Lead` rows with the same ID → dedup isn't matching; check that `eventID` (browser,
  capital ID) and `event_id` (server) carry the same value.
- A third `Lead` with **no** Event ID → a second pixel is on the page, almost always GTM. Go back
  to §1.2.

**5. Is it recorded?** The lead row has `metaCapiSentAt` set and `metaCapiError` null.

**6. Part D:** connect an ad account, run a sync, confirm campaigns and insight rows appear and
that a second sync updates rather than duplicates them.

---

## 8. Production rollout

1. **Clear `META_CAPI_TEST_EVENT_CODE`.** Leave it set and every real lead goes to the test panel
   and counts as zero conversions. This is the most common way a working setup silently produces
   nothing.
2. Set env vars on the host. `NEXT_PUBLIC_*` values are baked in at **build** time — a redeploy is
   required, not just a restart.
3. Remove any competing Meta tags from GTM.
4. Confirm on the live domain: load it, watch Test events (with a code temporarily set), submit a
   real form.
5. After a day of real traffic, check **Event Match Quality** on the `Lead` event in Events
   Manager. Below ~6 means identifiers are too thin — usually a missing country code on phones, or
   no `fbc`/`fbp` reaching the server.

---

## 9. Pitfalls reference

| Symptom | Cause | Fix |
|---|---|---|
| Nothing sent, no error recorded | Env var is `""` — falsy, so the guard clause returns early | Check for empty strings first |
| `(#100) Missing Permission` when reading the dataset | Normal — CAPI tokens are write-scoped | Ignore; only a POST proves the token |
| Test events never appear despite `events_received: 1` | Offline channel code used for a `website` event | Use the Website channel's code |
| Overview tab empty while testing | Correct — test events are excluded from dataset metrics | Watch the Test events tab |
| Leads counted twice | A second pixel firing `Lead` with no `eventID` | Remove the GTM tag; use `trackSingle` |
| Conversions appear in a *different* dataset | `fbq('track')` broadcasting to all initialised pixels | `trackSingle` with an explicit pixel ID |
| Low Event Match Quality | Phone missing country code; no `fbc`/`fbp` | §5.2 and §3.4 |
| Event rejected as too old | `event_time` more than 7 days in the past | Send at conversion time; for manual sends use *now* |
| Pixel missing in production | `NEXT_PUBLIC_*` not present at build time | Set it on the host, redeploy |
| Only the first page counted | `PageView` never re-fired on client-side navigation | The route-change effect in §4.2 |
| Attribution blank on leads | Params overwritten on second pageview | The sessionStorage cache in §3.2 |
| Admin traffic in the data | Pixel mounted on admin routes | The `/admin` guard in §4.2 |

---

## 10. Appendix — a complete `Lead` event

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
      "custom_data": {
        "value": 0,
        "currency": "INR",
        "lead_source": "meta"
      }
    }
  ],
  "access_token": "EAA…",
  "test_event_code": "TEST12345"
}
```

Constraints worth remembering: `event_time` is **unix seconds** (not milliseconds) and must be
within 7 days; `user_data` must contain at least one identifier or the event is rejected; up to
1000 events per `data` array; standard event names are case-sensitive (`Lead`, not `lead`).
