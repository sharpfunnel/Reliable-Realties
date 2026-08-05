# Pattern: Short Lead Form + Thank-You Page for Optional Details

Reusable playbook for splitting a real-estate landing page's contact form into
a **short required form** (Name + Phone) on the landing page and a **thank-you
page** where the visitor can optionally add Email, Budget, and a Message to
the same lead. Implemented in this repo at:

- [components/sections/Contact.tsx](../components/sections/Contact.tsx) — main form
- [components/sections/Hero.tsx](../components/sections/Hero.tsx) — hero form preview card
- [app/api/leads/route.ts](../app/api/leads/route.ts) — `POST` (create) + `PATCH` (enrich)
- [app/thank-you/page.tsx](../app/thank-you/page.tsx) — confirmation page
- [components/sections/ThankYouOptionalForm.tsx](../components/sections/ThankYouOptionalForm.tsx) — optional follow-up form

## Why

- A 2-field form converts better than a long one — less friction on the
  landing page.
- The lead is still captured (name + phone) even if the visitor never fills
  in the optional details.
- `/thank-you` becomes a **stable URL** you can point Meta/Google Ads
  conversion tracking and GTM triggers at, instead of relying on an
  easy-to-miss inline success message.

## Flow

```
Landing page form (name + phone)
        │  POST /api/leads  → creates Lead row, returns { leadId }
        ▼
router.push(`/thank-you?leadId=${leadId}`)
        │
        ▼
/thank-you page
        │  optional secondary form (email, budget, message)
        │  PATCH /api/leads  → { leadId, email, budget, message }
        ▼
Lead row enriched in place (same row, not a new lead)
```

## 1. Data layer

The Lead model just needs its non-required fields to be optional (Prisma
example — adapt to whatever ORM/DB the target project uses):

```prisma
model Lead {
  id      String  @id @default(cuid())
  name    String?
  phone   String?
  email   String?
  budget  String?
  message String?
  // ...tracking / attribution fields, status, timestamps, etc.
}
```

Nothing else changes at the schema level — this pattern is only about
**when** each field gets written, not the shape of the row.

## 2. API route: `POST` creates, `PATCH` enriches

`POST` requires only name + (phone or email), and returns the new row's id so
the client can pass it forward:

```ts
// app/api/leads/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  const name = str(body.name);
  const phone = str(body.phone);

  if (!name || !phone) {
    return NextResponse.json({ ok: false, error: "name and phone are required" }, { status: 400 });
  }

  const lead = await prisma.lead.create({ data: { name, phone /* ...attribution fields */ } });

  return NextResponse.json({ ok: true, leadId: lead.id });
}

/** Fills in optional details a visitor adds on the thank-you page. */
export async function PATCH(request: Request) {
  const body = await request.json();
  const leadId = str(body.leadId);
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });
  }

  const email = str(body.email);
  const budget = str(body.budget);
  const message = str(body.message);
  if (!email && !budget && !message) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(email ? { email } : {}),
        ...(budget ? { budget } : {}),
        ...(message ? { message } : {}),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
```

Key points:
- `PATCH` only ever writes fields that were actually provided — a visitor who
  fills in just the budget doesn't blank out email/message.
- `leadId` is the Lead row's own id — no separate "session token" needed to
  tie the two requests together.

## 3. Landing page form — trim to name + phone

Strip every non-essential field from the on-page form. Keep the consent
checkbox if you use one. On success, redirect to the thank-you page with the
new lead's id in the query string:

```tsx
const res = await fetch("/api/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: data.get("name"), phone: data.get("phone") }),
});
const payload = await res.json().catch(() => null);
if (!res.ok) throw new Error(payload?.error ?? "Submission failed");

form.reset();
router.push(payload?.leadId ? `/thank-you?leadId=${payload.leadId}` : "/thank-you");
```

If the landing page also has a decorative "form preview" card (e.g. in the
hero), trim its placeholder fields to match — Name + Phone only — so it
doesn't advertise fields that no longer exist. See the `ContactFormPreviewCard`
in [Hero.tsx](../components/sections/Hero.tsx) for the non-interactive version.

## 4. Thank-you page

A server component at `app/thank-you/page.tsx` that reads `leadId` from
`searchParams` and renders the optional follow-up form only when it's
present (a direct visit to `/thank-you` with no id just shows the
confirmation, no form):

```tsx
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string | string[] }>;
}) {
  const { leadId } = await searchParams;
  const resolvedLeadId = typeof leadId === "string" ? leadId : undefined;

  return (
    <main>
      {/* logo, checkmark, "thanks for reaching out" copy, phone/WhatsApp links, back-home CTA */}
      {resolvedLeadId ? <ThankYouOptionalForm leadId={resolvedLeadId} /> : null}
    </main>
  );
}
```

Set `robots: { index: false, follow: true }` in its `metadata` — it's a
transient confirmation URL, not something you want ranking in search.

## 5. Optional follow-up form

A small client component that `PATCH`es the same lead. Requires at least one
field filled in before submitting, and swaps to a thank-you message on
success instead of just resetting:

```tsx
"use client";
export function ThankYouOptionalForm({ leadId }: { leadId: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = data.get("email");
    const budget = data.get("budget");
    const message = data.get("message");
    if (!email && !budget && !message) return; // require at least one field

    setStatus("submitting");
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, email, budget, message }),
    });
    setStatus(res.ok ? "success" : "error");
  }

  // ...render form (email input, budget select, message textarea) or success message
}
```

## Adapting this to another landing page

1. Confirm the Lead/Enquiry model has optional (nullable) columns for
   whatever fields you're deferring — usually email, budget/price range, and
   message.
2. Split the existing single API route handler into `POST` (create, minimal
   required fields) and `PATCH` (update by id, optional fields only).
3. Trim the on-page form's JSX and its submit payload down to the required
   fields. Update any decorative preview copies of the form to match.
4. On successful submit, redirect (`router.push`) to `/thank-you?leadId=...`
   instead of showing an inline success state.
5. Add `app/thank-you/page.tsx` — reuse this project's copy/branding
   structure (logo, checkmark, contact links, back-home CTA) and read
   `leadId` from `searchParams`.
6. Add the optional follow-up form component, gated on `leadId` being
   present.
7. If you don't need conversion tracking, you can drop the `leadId` query
   param entirely and just redirect to a static `/thank-you` — the pattern
   still works, you just lose the ability to enrich the same row afterward
   (a thank-you-page submission would need its own lightweight create call
   instead).

## Optional: pairing with ad-platform conversion tracking

This repo also uses the lead id as the shared `event_id` between a
browser-side Meta Pixel `Lead` event and a server-side Meta Conversions API
call, so the same conversion isn't double-counted (see
[lib/meta/pixel.ts](../lib/meta/pixel.ts) and
[lib/meta/capi.ts](../lib/meta/capi.ts)). That's a separate, optional layer
on top of this pattern — only relevant if the target project also runs Meta
Ads and wants deduplicated conversions. Skip it entirely if not.
