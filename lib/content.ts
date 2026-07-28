/**
 * Single source of truth for every piece of copy on the landing page.
 * Sections read from here so content edits never require touching markup.
 *
 * Project: Reliable Realties — Codename Magnitude
 * IT & corporate offices, showrooms and retail — Plot D-123, Nerul MIDC,
 * Navi Mumbai. Unit areas, dimensions and the floor stack below are taken
 * from the architect's drawings (Soyuz Talib Architects, 18-03-2026).
 */

export const site = {
  name: "Reliable Realties",
  /** Used where the full name is too wide (nav wordmark, schema shortName). */
  shortName: "Reliable",
  tagline: "Built for Business",
  project: "Codename Magnitude",
  description:
    "Reliable Realties presents Codename Magnitude — IT and corporate offices, showrooms and retail at Plot D-123, Nerul MIDC, Navi Mumbai. Units from ₹55.50 Lakh.",
  url: "https://reliablerealties.com",

  contactPerson: "Aanchal Jaidhara",
  phone: "+91 98191 81914",
  phoneHref: "tel:+919819181914",
  whatsappHref: "https://wa.me/919819181914",
  email: "reliablerealties@gmail.com",

  addressLine1: "D-123, MIDC Industrial Area, near SIES Pharmaceutical College",
  addressLine2: "Nerul MIDC, Navi Mumbai 400706",
  /** Condensed form for tight columns (footer). */
  addressShort: "D-123, MIDC Industrial Area, Nerul MIDC, Navi Mumbai 400706",
  city: "Navi Mumbai",

  /** Headline price. Change here and it updates hero, FAQ, schema and footer. */
  startingPrice: "₹55.50 Lakh",
  startingPriceShort: "₹55.50 L",
  startingPriceValue: 5550000,
  priceRange: "₹55.50 Lakh onwards",
  possession: "December 2029",

  /** From the architect's area statement. */
  totalSaleArea: "2,27,978 sq ft",
  floors: 20,
  lifts: 5,

  /** Footer credit — the agency delivering this site. */
  credit: "Zoot",
} as const;

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Amenities", href: "#amenities" },
  { label: "Unit Plans", href: "#unit-plans" },
  { label: "Floor Plans", href: "#floor-plans" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Faq's", href: "#faq" },
  { label: "Contact", href: "#contact" },
] as const;

/** Primary call to action, reused by the navbar and mobile menu. */
export const primaryCta = { label: "Book a Site Visit", href: "#contact" } as const;

/* -------------------------------------------------------------------------- */
/*                                    Hero                                    */
/* -------------------------------------------------------------------------- */

export const hero = {
  eyebrow: "IT & Corporate Offices · Nerul MIDC",
  // Kept to two display lines at 1440px so the stat cards stay above the fold.
  title: "Commercial Spaces Built for Growth",
  // Hard break keeps the lead to two lines from `sm` upward.
  subtitle:
    "IT & corporate offices and showrooms in Nerul MIDC, Navi Mumbai.\nCodename Magnitude by Reliable Realties.",
  primaryCta: { label: "Contact us", href: "#contact" },
  secondaryCta: { label: "Book a Site Visit", href: "#contact" },
  proof: {
    // PLACEHOLDER — confirm the real figure with Reliable Realties before launch.
    count: "500+",
    label: "Happy Clients",
    note: "Trusted across Navi Mumbai",
    avatars: [
      "/images/avatar-hero-1.png",
      "/images/avatar-hero-2.png",
      "/images/avatar-hero-3.png",
    ],
  },
  stats: [
    {
      icon: "wallet",
      value: "₹55.50 L",
      label: "Starting Price",
      note: "Offices, showrooms & retail",
    },
    {
      icon: "briefcase",
      value: "IT",
      label: "& Corporate Offices",
      note: "1,032 – 2,360 sq ft units",
    },
    {
      icon: "pin",
      value: "MIDC",
      label: "Nerul, Navi Mumbai",
      note: "Prime Commercial Belt",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                   About                                    */
/* -------------------------------------------------------------------------- */

export const about = {
  eyebrow: "About Codename Magnitude",
  title: "A Commercial Address Built to Last",
  // Hard line breaks mirror the reference's three-line balance.
  body: "A 20-storey commercial tower in the heart of Nerul MIDC — IT and corporate\noffices above double-height showrooms, served by five lifts, an automated\nparking tower and a rooftop restaurant.",
  cta: { label: "View Unit Plans", href: "#unit-plans" },
  thumbnails: [
    {
      src: "/images/about-thumb-1.png",
      alt: "Exterior view of the Codename Magnitude commercial development",
    },
    {
      src: "/images/about-thumb-2.png",
      alt: "Naturally lit interior of a showroom unit",
    },
  ],
  feature: {
    src: "/images/about-main.png",
    alt: "Codename Magnitude commercial building at golden hour",
  },
  highlights: [
    { icon: "calendarCheck", value: "2029", label: "Possession" },
    { icon: "briefcase", label: "IT & Corporate\nOffices" },
    { icon: "pin", label: "MIDC\nNerul Address" },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                 Why choose                                 */
/* -------------------------------------------------------------------------- */

export const whyChoose = {
  eyebrow: "Why Choose Reliable Realties",
  title: "Why Choose Codename Magnitude?",
  card: {
    title: "Built with intention. Positioned for growth.",
    body: "2,27,978 sq ft of pure commercial space, planned floor by floor around the way modern businesses actually work.",
  },
  images: {
    tall: {
      src: "/images/why-tall.png",
      alt: "Double-height entrance lobby",
    },
    topRight: {
      src: "/images/why-thumb-1.png",
      alt: "Outdoor breakout and dining terrace",
    },
    bottomRight: {
      src: "/images/about-thumb-2.png",
      alt: "Open-plan office interior",
    },
  },
  pillars: [
    {
      number: "01",
      title: "Built for IT & Corporate Teams",
      body: "Efficient floor plates from 1,032 sq ft, five lifts, a 20'6\" lift lobby and an automated parking tower on every level.",
    },
    {
      number: "02",
      title: "Flexible Unit Sizes",
      body: "Compact suites through full corner floors — take 1,032 sq ft today and expand into 2,360 sq ft on the same floor later.",
    },
    {
      number: "03",
      title: "Showrooms & Retail Frontage",
      body: "Double-height showrooms on the ground and first floors, with a 22'2\" clear entrance level facing the main road.",
    },
    {
      number: "04",
      title: "Strong Investment Case",
      body: "A pure commercial asset in one of Navi Mumbai's most established and consistently in-demand business districts.",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                 Amenities                                  */
/* -------------------------------------------------------------------------- */

export const amenities = {
  eyebrow: "Amenities",
  title: "Amenities Built Around the Working Day",
  // Every entry below corresponds to a space in the architect's drawings.
  body: "Shared facilities planned into the building itself — an arrival lobby, a recreational floor and a rooftop restaurant, all drawn into the approved plans.",
  items: [
    {
      icon: "concierge",
      title: "Grand Entrance Lobby",
      body: "28'6\" × 31'2\" arrival lobby on the ground floor.",
      image: "/images/amenity-concierge.png",
      alt: "Reception desk in a double-height commercial entrance lobby",
    },
    {
      icon: "utensils",
      title: "Rooftop Restaurant",
      body: "7,952 sq ft restaurant on the 20th floor.",
      image: "/images/amenity-lounge.png",
      alt: "Restaurant interior with warm lighting and city views",
    },
    {
      icon: "sunset",
      title: "Natural Sky Terrace",
      body: "1,948 sq ft open-air deck alongside the restaurant.",
      image: "/images/amenity-terrace.png",
      alt: "Open-air rooftop terrace overlooking the city at sunset",
    },
    {
      icon: "dumbbell",
      title: "Fitness Centre",
      body: "1,680 sq ft gym on the 15th recreational floor.",
      image: "/images/amenity-wellness.png",
      alt: "Fitness studio with floor-to-ceiling glazing",
    },
    {
      icon: "coffee",
      title: "Café & Kitchen",
      body: "1,680 sq ft catering kitchen serving the 15th floor.",
      image: "/images/why-thumb-1.png",
      alt: "Café seating area with outdoor tables",
    },
    {
      icon: "car",
      title: "Parking & Driveways",
      body: "Automated parking tower with 7.5m–10.3m driveways.",
      image: "/images/amenity-courtyard.png",
      alt: "Landscaped driveway running alongside a commercial building",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                 Unit plans                                 */
/* -------------------------------------------------------------------------- */

/**
 * Unit mix taken directly from the architect's area statement.
 * CA = carpet area, SA = sale area (carpet area × 2.0 loading).
 */
export const unitPlans = {
  eyebrow: "Unit Plans",
  title: "Efficient Layouts, Flexible Footprints",
  body: "IT and corporate offices, showrooms and retail across twenty floors. Every area below is taken from the approved architectural drawings.",
  /** Label above the headline figure in the detail panel. */
  metricLabel: "Sale Area",
  planLinkLabel: "View full floor plan",
  units: [
    {
      id: "office-compact",
      name: "Office 2–7",
      type: "Compact Office",
      area: "1,032 sq ft",
      heading: "Compact IT & Corporate Office",
      image: "/images/plans/plan-03.png",
      alt: "Typical office floor plan showing compact office units 2 to 7",
      features: [
        { icon: "maximize", label: "Carpet Area — 516 sq ft" },
        { icon: "ruler", label: "29'7\" × 15'4\"" },
        { icon: "bath", label: "Attached W.C." },
        { icon: "building", label: "Floors 2–14" },
      ],
    },
    {
      id: "office-corner",
      name: "Office 1 & 8",
      type: "Corner Office",
      area: "2,360 sq ft",
      heading: "Corner IT & Corporate Office",
      image: "/images/plans/plan-03.png",
      alt: "Typical office floor plan showing corner office units 1 and 8",
      features: [
        { icon: "maximize", label: "Carpet Area — 1,180 sq ft" },
        { icon: "ruler", label: "29'7\" × 29'6\"" },
        { icon: "bath", label: "Attached W.C." },
        { icon: "building", label: "Floors 2–14" },
      ],
    },
    {
      id: "office-premium",
      name: "Office 2–4",
      type: "Premium Office",
      area: "1,684 sq ft",
      heading: "Premium High-Floor Office",
      image: "/images/plans/plan-06.png",
      alt: "High-floor plan showing premium office units 2 to 4",
      features: [
        { icon: "maximize", label: "Carpet Area — 842 sq ft" },
        { icon: "ruler", label: "23'1\" × 31'2\"" },
        { icon: "bath", label: "Attached W.C." },
        { icon: "building", label: "Floors 16–19" },
      ],
    },
    {
      id: "office-signature",
      name: "Office 1 & 5",
      type: "Signature Office",
      area: "1,974 sq ft",
      heading: "Signature Corner Office",
      image: "/images/plans/plan-06.png",
      alt: "High-floor plan showing signature corner office units 1 and 5",
      features: [
        { icon: "maximize", label: "Carpet Area — 987 sq ft" },
        { icon: "ruler", label: "23'1\" × 29'6\"" },
        { icon: "bath", label: "Attached W.C." },
        { icon: "building", label: "Floors 16–19" },
      ],
    },
    {
      id: "showroom-ground",
      name: "Showroom 1",
      type: "Ground Showroom",
      area: "3,750 sq ft",
      heading: "Ground Floor Showroom",
      image: "/images/plans/plan-01.png",
      alt: "Ground floor plan showing the showroom, entrance lobby and parking",
      features: [
        { icon: "maximize", label: "Carpet Area — 1,875 sq ft" },
        { icon: "layers", label: "22'2\" Floor Height" },
        { icon: "store", label: "Main Road Frontage" },
        { icon: "car", label: "Parking Tower Access" },
      ],
    },
    {
      id: "showroom-first",
      name: "Showroom 1",
      type: "First Floor Showroom",
      area: "13,122 sq ft",
      heading: "Full-Floor First Level Showroom",
      image: "/images/plans/plan-02.png",
      alt: "First floor plan showing the full-floor showroom",
      features: [
        { icon: "maximize", label: "Carpet Area — 6,561 sq ft" },
        { icon: "layers", label: "11'10\" Floor Height" },
        { icon: "store", label: "Full-Floor Plate" },
        { icon: "building", label: "1st Floor" },
      ],
    },
  ],
  /** Vertical mix, read off the schematic section. */
  stack: [
    { floors: "G – 1", use: "Showrooms & Retail" },
    { floors: "2 – 14", use: "IT & Corporate Offices" },
    { floors: "15", use: "Gym & Kitchen" },
    { floors: "16 – 19", use: "Premium Offices" },
    { floors: "20", use: "Restaurant & Terrace" },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                      Floor plans — architect's drawings                    */
/* -------------------------------------------------------------------------- */

export const planGallery = {
  eyebrow: "Architectural Drawings",
  title: "Floor Plans, Level by Level",
  body: "Every level of the tower, from the ground-floor showroom to the twentieth. Select any sheet to open it full size.",
  pdfHref: "/plans/reliable-realties-codename-magnitude-plans.pdf",
  pdfLabel: "Download all plans (PDF)",
  disclaimer:
    "All plans shown are tentative and subject to change as per planning, structural feasibility and statutory approvals.",
  slides: [
    {
      src: "/images/plans/plan-01.png",
      title: "Ground Floor Plan",
      subtitle: "Showroom, entrance lobby & parking tower",
    },
    {
      src: "/images/plans/plan-02.png",
      title: "1st Floor Plan",
      subtitle: "Full-floor showroom — 13,122 sq ft",
    },
    {
      src: "/images/plans/plan-03.png",
      title: "Typical Office Floor",
      subtitle: "Floors 2–6, 8–11, 13 & 14 — nine offices",
    },
    {
      src: "/images/plans/plan-04.png",
      title: "7th & 12th Floor Plan",
      subtitle: "Eight offices with refuge area",
    },
    {
      src: "/images/plans/plan-05.png",
      title: "15th Floor Plan",
      subtitle: "Recreational level — gym & kitchen",
    },
    {
      src: "/images/plans/plan-06.png",
      title: "16th, 18th & 19th Floor",
      subtitle: "Six premium offices per floor",
    },
    {
      src: "/images/plans/plan-07.png",
      title: "17th Floor Plan",
      subtitle: "Five premium offices with refuge area",
    },
    {
      src: "/images/plans/plan-08.png",
      title: "20th Floor Plan",
      subtitle: "Restaurant, office & natural terrace",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                Testimonials                                */
/* -------------------------------------------------------------------------- */

export const testimonials = {
  eyebrow: "Testimonials",
  title: "Trusted by Businesses. Backed by Service.",
  body: "Hear from owners and investors who found the right commercial space with the Reliable Realties team.",
  items: [
    {
      quote:
        "The location does the selling for us. Walk-ins went up from the first month, and the frontage is exactly what a showroom needs in this belt.",
      name: "Rohan Mehta",
      role: "Showroom Owner",
      avatar: "/images/avatar-01.png",
    },
    {
      quote:
        "From the first site visit to registration, the process was straightforward. Every document was explained before we signed anything.",
      name: "Priya Nair",
      role: "Founder, Design Studio",
      avatar: "/images/avatar-02.png",
    },
    {
      quote:
        "I was looking at commercial purely as an investment. Nerul MIDC has held its value, and the rental interest here has been steady.",
      name: "Amit Deshpande",
      role: "Investor",
      avatar: "/images/avatar-03.png",
    },
    {
      quote:
        "Access to Thane-Belapur Road and the highway matters for our operations. This address cut our daily movement time considerably.",
      name: "Sneha Kulkarni",
      role: "Director, Logistics Firm",
      avatar: "/images/avatar-04.png",
    },
    {
      quote:
        "The unit sizes were flexible enough that we did not have to overcommit. We took what we needed and have room to expand later.",
      name: "Faizan Shaikh",
      role: "Clinic Owner",
      avatar: "/images/avatar-05.png",
    },
    {
      quote:
        "First time buying commercial and I had a lot of questions. The team stayed patient and never pushed me toward a bigger unit.",
      name: "Nikhil Rane",
      role: "First-Time Commercial Buyer",
      avatar: "/images/avatar-06.png",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                  Location                                  */
/* -------------------------------------------------------------------------- */

export const location = {
  eyebrow: "Location Advantage",
  title: "Well Connected. Perfectly Positioned.",
  body: "Nerul MIDC puts your business at the centre of Navi Mumbai — established infrastructure, effortless access, and every daily convenience within minutes.",
  advantages: [
    {
      icon: "move",
      title: "Excellent Connectivity",
      body: "Direct access to Thane-Belapur Road, Palm Beach Road and the Sion-Panvel Highway.",
    },
    {
      icon: "send",
      title: "Established Business Belt",
      body: "Surrounded by Nerul MIDC's existing industrial, retail and corporate ecosystem.",
    },
    {
      icon: "archive",
      title: "Transit & Airport Links",
      body: "Minutes from Nerul and Seawoods stations and the new Navi Mumbai International Airport.",
    },
  ],
  distances: [
    { icon: "book", time: "5 mins", place: "SIES College" },
    { icon: "tram", time: "8 mins", place: "Nerul Station" },
    { icon: "basket", time: "10 mins", place: "Seawoods Grand Central" },
    { icon: "move", time: "12 mins", place: "Palm Beach Road" },
    { icon: "building", time: "20 mins", place: "Vashi Business District" },
    { icon: "plane", time: "25 mins", place: "Navi Mumbai Airport" },
  ],
  /** Pins rendered on the stylised map. Percentages are of the map viewport. */
  mapPins: [
    { icon: "plane", label: "Navi Mumbai Airport", time: "25 min", x: 12, y: 14 },
    { icon: "building", label: "Vashi District", time: "20 min", x: 62, y: 12 },
    { icon: "move", label: "Palm Beach Road", time: "12 min", x: 88, y: 30 },
    { icon: "tram", label: "Nerul Station", time: "8 min", x: 9, y: 46 },
    { icon: "basket", label: "Seawoods Grand Central", time: "10 min", x: 88, y: 74 },
    { icon: "book", label: "SIES College", time: "5 min", x: 46, y: 76 },
    { icon: "hospital", label: "Terna Hospital", time: "9 min", x: 14, y: 78 },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                    FAQ                                     */
/* -------------------------------------------------------------------------- */

export const faq = {
  eyebrow: "FAQ",
  title: "Frequently Asked Questions",
  body: `Everything you need to know about ${site.project}.`,
  items: [
    {
      question: "What types of units are available?",
      answer:
        "Codename Magnitude is a pure commercial project across twenty floors: double-height showrooms on the ground and first floors, IT and corporate offices from the 2nd to the 14th floor, a recreational level on the 15th, premium offices on the 16th to 19th, and a restaurant with a sky terrace on the 20th. Office units range from 1,032 sq ft to 2,360 sq ft sale area.",
    },
    {
      question: "What is the price range?",
      answer:
        "Units start from ₹55.50 Lakh. The final figure depends on the floor, unit type, frontage and carpet area — our team will share the current price sheet and applicable charges on enquiry.",
    },
    {
      question: "Is the project RERA registered?",
      answer:
        "Yes. All project approvals, RERA details and compliance documents are shared transparently with interested buyers during the consultation process.",
    },
    {
      question: "Where exactly is the project located?",
      answer:
        "D-123, MIDC Industrial Area, near SIES Pharmaceutical College, Nerul MIDC, Navi Mumbai 400706 — within the established Nerul MIDC commercial belt.",
    },
    {
      question: "What is the possession timeline?",
      answer:
        "Possession is scheduled for December 2029. Our team will share the current construction status and the detailed handover schedule during your site visit.",
    },
    {
      question: "Is the project suitable for an IT or corporate office?",
      answer:
        "Yes. Floors 2 to 19 are planned as IT and corporate office space, with efficient floor plates from 1,032 sq ft, five lifts serving a 20'6\" × 9'0\" lift lobby, an attached W.C. in every unit and an automated parking tower on each level.",
    },
    {
      question: "Can I customise the interiors of my unit?",
      answer:
        "Units are handed over in a fit-out ready condition, so you are free to plan interiors around your business. Our team can guide you on permitted changes, service points and approvals.",
    },
    {
      question: "What are the payment plan options?",
      answer:
        "Construction-linked and flexible payment plans may be available depending on the unit and booking stage. We also assist with commercial loan referrals from leading banks and NBFCs.",
    },
    {
      question: "Can I schedule a site visit?",
      answer:
        "Yes. Call or WhatsApp us on +91 98191 81914 and our team will arrange a site visit at a time that suits you, and walk you through the units, plans and pricing.",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                  Contact                                   */
/* -------------------------------------------------------------------------- */

export const contact = {
  eyebrow: "Get in Touch",
  title: "Let's Find the Right Space for Your Business.",
  // Hard line breaks mirror the reference's three-line balance.
  body: "Units start from ₹55.50 Lakh — ask us for the current price sheet.\nOur team is just a call or WhatsApp away.\nWe'd love to hear from you!",
  image: {
    src: "/images/about-main.png",
    alt: "Codename Magnitude commercial building at golden hour",
  },
  details: [
    { icon: "phone", label: "Call Us", value: site.phone, href: site.phoneHref },
    {
      icon: "whatsapp",
      label: "WhatsApp",
      value: site.phone,
      href: site.whatsappHref,
      external: true,
    },
    {
      icon: "mail",
      label: "Email Us",
      value: site.email,
      href: `mailto:${site.email}`,
    },
    {
      icon: "pin",
      label: "Visit Us",
      value: `${site.addressLine1}\n${site.addressLine2}`,
    },
    {
      icon: "calendar",
      label: "Schedule a Visit",
      value: "Book a walkthrough of the units at your convenience.",
    },
  ],
  form: {
    title: "Send Us a Message",
    subtitle: "Fill in your details and we'll get back to you shortly.",
    budgetLabel: "Budget",
    budgets: [
      "₹55.50 L – ₹75 L",
      "₹75 L – ₹1 Cr",
      "₹1 Cr – ₹1.5 Cr",
      "₹1.5 Cr and above",
    ],
    consent: `I agree to be contacted by ${site.name} about this enquiry.`,
    submit: "Submit",
  },
} as const;

/* -------------------------------------------------------------------------- */
/*                                   Footer                                   */
/* -------------------------------------------------------------------------- */

export const footer = {
  socials: [
    { name: "Facebook", href: "https://facebook.com" },
    { name: "Instagram", href: "https://instagram.com" },
    { name: "WhatsApp", href: site.whatsappHref },
    { name: "YouTube", href: "https://youtube.com" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms-of-service" },
  ],
} as const;
