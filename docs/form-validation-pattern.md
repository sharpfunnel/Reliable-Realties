# Form Validation Pattern (name / phone / email)

Reusable recipe for validating lead-capture forms (name, phone, email) on
both the client and the server. No external library required — plain
regex helpers shared between React form components and the API route that
persists the data.

## 1. Shared validation helpers

Create `lib/validation.ts`:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS_RE = /^\+?[0-9\s\-()]+$/;
const NAME_RE = /^[A-Za-z\s'.-]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

// Requires exactly 10 digits (adjust to match your target phone format —
// e.g. allow a country code, or widen to a 7-15 digit range for
// international numbers).
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_CHARS_RE.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 10;
}

export function isValidName(value: string): boolean {
  return NAME_RE.test(value.trim());
}

// Live-typing filter: strips disallowed characters and caps digit count.
export function sanitizePhoneInput(value: string): string {
  const cleaned = value.replace(/[^0-9\s\-+()]/g, "");
  let digitCount = 0;
  let result = "";
  for (const char of cleaned) {
    if (/[0-9]/.test(char)) {
      digitCount += 1;
      if (digitCount > 10) continue;
    }
    result += char;
  }
  return result;
}

// Live-typing filter: letters, spaces, apostrophes, periods, hyphens only.
export function sanitizeNameInput(value: string): string {
  return value.replace(/[^A-Za-z\s'.-]/g, "");
}
```

Adjust the digit cap / regex to match the target site's phone format
(10 digits is India-specific; use 7-15 digits for a general international
form, or add a country-code field).

## 2. Client-side wiring (React form component)

Three layers, from loosest to strictest:

1. **Live-typing filter** (`onChange`) — blocks bad characters as the user types.
2. **`pattern`/`minLength`/`maxLength`** attributes — native browser validation + tooltip on submit.
3. **JS check before the fetch call** — the real gate; shows your own inline error message and prevents the request entirely.

```tsx
import { isValidName, isValidPhone, sanitizeNameInput, sanitizePhoneInput } from "@/lib/validation";

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name") ?? "").trim();
  const phone = String(data.get("phone") ?? "").trim();

  if (!isValidName(name)) {
    setError("Please enter your full name.");
    setStatus("error");
    return;
  }
  if (!isValidPhone(phone)) {
    setError("Please enter a valid phone number.");
    setStatus("error");
    return;
  }

  // ... proceed with fetch, sending the trimmed `name`/`phone` values
}
```

JSX:

```tsx
<input
  name="name"
  type="text"
  required
  minLength={2}
  onChange={(e) => {
    const sanitized = sanitizeNameInput(e.target.value);
    if (sanitized !== e.target.value) e.target.value = sanitized;
  }}
/>

<input
  name="phone"
  type="tel"
  required
  pattern="(?=(?:\D*\d){10}\D*$)[0-9\s\-()]+"
  title="Enter a valid 10-digit phone number"
  maxLength={14}
  inputMode="tel"
  onChange={(e) => {
    const sanitized = sanitizePhoneInput(e.target.value);
    if (sanitized !== e.target.value) e.target.value = sanitized;
  }}
/>

<input
  type="email"
  name="email"
  onChange={(e) => e.target.value} // email needs no live filter, just format check
/>
```

For an optional email field (validate only if the user filled it in):

```tsx
const email = String(data.get("email") ?? "").trim();
if (email && !isValidEmail(email)) {
  setError("Please enter a valid email address.");
  setStatus("error");
  return;
}
```

## 3. Server-side wiring (API route)

**Never trust the client** — DevTools or a direct `fetch`/`curl` call bypasses
every client-side check above. Re-validate in the route handler that writes
to the database:

```ts
import { isValidEmail, isValidName, isValidPhone } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json();
  const name = str(body.name);   // trim + undefined-if-empty helper
  const phone = str(body.phone);
  const email = str(body.email);

  if (!name || (!phone && !email)) {
    return NextResponse.json(
      { ok: false, error: "name and at least one of phone/email are required" },
      { status: 400 },
    );
  }
  if (!isValidName(name)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid name" }, { status: 400 });
  }
  if (phone && !isValidPhone(phone)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid phone number" }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address" }, { status: 400 });
  }

  // ... proceed to persist the lead
}
```

## 4. Porting this to another landing page

1. Copy `lib/validation.ts` as-is (or adjust `isValidPhone`'s digit count /
   `NAME_RE` if the new site targets a different locale or allows
   non-Latin names).
2. In every lead-capture form component, add the `onChange` sanitizers plus
   the pre-fetch `isValid*` checks shown above.
3. In the API route(s) that receive the form POST/PATCH, add the same
   `isValid*` checks server-side — this is the boundary that actually
   matters, since it's the only one an attacker/bot can't bypass.
4. Keep the three layers (live filter, native `pattern`, JS check) — the
   live filter is UX polish, the JS check is what actually blocks a bad
   submit, and the server check is what actually protects the data.

## Reference implementation

See this repo's `lib/validation.ts`, `components/sections/Hero.tsx`,
`components/sections/Contact.tsx`, `components/sections/ThankYouOptionalForm.tsx`,
and `app/api/leads/route.ts` for the full working example this pattern was
extracted from.
