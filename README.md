# Reliable Realties — Codename Magnitude

Marketing landing page for **Codename Magnitude**, a pure-commercial office and
showroom development by Reliable Realties in Nerul MIDC, Navi Mumbai.

Built as a lead-generation page for Meta campaigns: every section funnels to the
enquiry form, which captures **Name, Phone, Email and Budget** as specified in
the client brief.

## Project facts (single source: [`lib/content.ts`](lib/content.ts))

| | |
| ---------- | -------------------------------------------------------------- |
| Project    | Reliable Realties — Codename Magnitude                          |
| Type       | Pure commercial — IT & corporate offices, showrooms, retail     |
| Price      | From **₹55.50 Lakh**                                            |
| Location   | D-123, MIDC Industrial Area, near SIES Pharmaceutical College, Nerul MIDC, Navi Mumbai 400706 |
| Possession | December 2029                                                   |
| Scale      | 20 floors · 2,27,978 sq ft total sale area · 5 lifts            |
| Architect  | Soyuz Talib Architects (drawings dated 18-03-2026)              |
| Contact    | Aanchal Jaidhara · +91 98191 81914 (call & WhatsApp) · connect@reliablerealties.com |

### Floor stack (from the schematic section)

| Floors  | Use                            |
| ------- | ------------------------------ |
| G – 1   | Showrooms & retail             |
| 2 – 14  | IT & corporate offices         |
| 15      | Recreational — gym & kitchen   |
| 16 – 19 | Premium offices                |
| 20      | Restaurant & natural terrace   |

### Unit mix (carpet → sale area, 2.0 loading)

| Unit          | Dimensions      | Carpet    | Sale area  | Floors  |
| ------------- | --------------- | --------- | ---------- | ------- |
| Office 2–7    | 29'7" × 15'4"   | 516       | 1,032      | 2–14    |
| Office 1 & 8  | 29'7" × 29'6"   | 1,180     | 2,360      | 2–14    |
| Office 2–4    | 23'1" × 31'2"   | 842       | 1,684      | 16–19   |
| Office 1 & 5  | 23'1" × 29'6"   | 987       | 1,974      | 16–19   |
| Showroom      | —               | 1,875     | 3,750      | Ground  |
| Showroom      | —               | 6,561     | 13,122     | 1st     |

## Stack

| Concern    | Choice                                                          |
| ---------- | --------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack)                              |
| Styling    | Tailwind CSS v4 with a token-first `@theme` layer               |
| Fonts      | `next/font/google` — Cormorant Garamond, Playfair Display, Inter |
| Icons      | `lucide-react`; brand marks are hand-authored inline SVG        |
| Animation  | CSS transitions + one `IntersectionObserver` per reveal         |

No animation library is bundled: scroll reveals, the testimonial marquee, the
accordion and the tab panel are all CSS-driven, which keeps the client bundle
small and makes `prefers-reduced-motion` trivial to honour.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

## Project structure

```
app/
  layout.tsx        Fonts, metadata, Open Graph, viewport
  page.tsx          Section composition + JSON-LD structured data
  icon.svg          Favicon (brand mark)
  globals.css       Design tokens, typography utilities, keyframes
components/
  layout/           Navbar, Footer
  sections/         Hero, About, WhyChoose, Amenities, UnitPlans, PlanGallery,
                    Testimonials, Location (+ LocationMap), Faq, Contact
  ui/               Button, Section/SectionHeader/Eyebrow, Reveal,
                    Icon registry, Logo, LogoMark
lib/
  content.ts        All copy, contact details and imagery in one typed module
  cn.ts             Classname joiner
public/images/      Photography and avatars
public/images/plans Architect's drawings, one PNG per PDF sheet
public/plans/       The source plan PDF, offered as a download
```

### Floor-plan gallery

[`components/sections/PlanGallery.tsx`](components/sections/PlanGallery.tsx) is a
carousel over eight floor-plan sheets, rendered to PNG at 1600px wide. It uses
native horizontal scrolling with CSS scroll-snap — touch, trackpad, buttons and
dots all drive the same scroll position, and the active index is derived from
that position rather than owned by React, so the controls can never drift out of
sync. Selecting a sheet opens it full-screen at source resolution, which these
drawings need to be legible.

**Sheet preparation.** The source drawings carry an architect's title block
across the foot of every page. It is cropped out at y=2118 (just below the
"tentative plans" note, above the separator rule) and the sheet frame is
re-closed, giving uniform 1600×2144 pages. The schematic section and area
statement sheets are excluded at the client's request. The downloadable PDF in
`public/plans/` is rebuilt from these cropped pages so it matches the site
rather than reinstating the removed material.

To regenerate after a drawing revision: render the new PDF to PNGs
(`pdfjs-dist` + `@napi-rs/canvas`), re-apply the crop, then rebuild the download
with `pdf-lib`. If the title block moves, re-measure the cut line before
cropping — the value is page-specific, not a fixed percentage.

### Content

Every string, phone number, price and image path lives in
[`lib/content.ts`](lib/content.ts). Updating pricing, possession dates or contact
details never requires touching a component.

### Brand

The gold accent (`--color-gold: #b68a5e`) is a single token in
[`app/globals.css`](app/globals.css) — change it there and the whole page
follows. The logo is inline SVG in
[`components/ui/LogoMark.tsx`](components/ui/LogoMark.tsx); swap it for the
client's supplied file when available.

### Locality map

[`components/sections/LocationMap.tsx`](components/sections/LocationMap.tsx) is a
hand-drawn SVG map carrying Reliable Realties' own branding — no third-party
tiles, no extra network request. Landmark pins and drive times come from
`location.mapPins`; labels are hidden below `md`, where the drive-time strip
beneath the map carries the same information.

## Responsiveness

| Range        | Behaviour                                                     |
| ------------ | ------------------------------------------------------------- |
| `< 768px`    | Single column, hamburger menu, stacked cards, icon-only map    |
| `768–1023px` | Two-column grids, inline nav links (CTA hidden)                |
| `≥ 1024px`   | Full layout — overlapping cards, floating proof card           |

## Accessibility

- Semantic landmarks (`header`, `main`, `footer`, `nav`) and a single `h1`.
- Accordion and tab list implement the ARIA patterns (`aria-expanded`,
  `aria-controls`, `role="tablist"`, `aria-selected`).
- Escape closes the mobile menu; collapsed menu links are `inert`.
- Every form control has a label; status messages use `aria-live`.
- Marquee duplicates are `aria-hidden`; all motion collapses under
  `prefers-reduced-motion`.

## Performance & SEO

- `next/image` everywhere, `priority` on the hero, per-breakpoint `sizes`.
- Server Components by default — only `Navbar`, `UnitPlans`, `Faq`, `Contact`
  and `Reveal` ship client JavaScript.
- Self-hosted fonts with `display: swap`; no external network requests.
- JSON-LD for `RealEstateAgent`, `Product` (INR price range) and `FAQPage`;
  Open Graph and Twitter cards set in the root layout.

### Analytics

Google Tag Manager (container `GTM-MV59B2B3`) is wired up in
[`components/analytics/GoogleTagManager.tsx`](components/analytics/GoogleTagManager.tsx)
and mounted from the root layout. Override the container per environment with
`NEXT_PUBLIC_GTM_ID`.

The loader uses next/script's `afterInteractive` strategy, so tags never block
first paint — the same trade-off `@next/third-parties` makes. Switch it to
`beforeInteractive` only if a tag must run before hydration (a consent manager,
for example), accepting the LCP cost.

## Before launch — outstanding items

1. **Photography.** All photography is placeholder stock. Replace the files in
   `public/images/` with real Codename Magnitude renders and site photos.
   (The floor plans in `public/images/plans/` are the client's real drawings.)
2. **"500+ Happy Clients".** Marked `PLACEHOLDER` in `lib/content.ts` — confirm
   the real figure with the client or remove the card.
3. **Testimonials.** Copy is representative, not collected. Replace with real
   quotes (and photos) before publishing.
4. **Per-unit pricing.** Only the ₹55.50 Lakh starting price is confirmed. Unit
   rows show sale area rather than price; add per-unit pricing once the live
   price sheet is available.
5. **RERA number.** Add the registration number to the FAQ and footer once
   supplied.
6. **Form delivery.** `Contact`'s submit handler is a stub — point it at a server
   action or API route that emails leads and triggers the WhatsApp alert to
   +91 98191 81914.
7. **Domain & social links.** `site.url` and the footer social URLs are
   placeholders.
#   R e l i a b l e - R e a l t i e s  
 