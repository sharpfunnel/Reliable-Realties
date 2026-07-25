/**
 * Single source of truth for every piece of copy on the landing page.
 * Sections read from here so content edits never require touching markup.
 *
 * Project: Reliable Realties — Codename Magnitude
 * Pure commercial offices & showrooms, Nerul MIDC, Navi Mumbai.
 */

export const site = {
  name: "Reliable Realties",
  /** Used where the full name is too wide (nav wordmark, schema shortName). */
  shortName: "Reliable",
  tagline: "Built for Business",
  project: "Codename Magnitude",
  description:
    "Reliable Realties presents Codename Magnitude — pure commercial offices and showrooms in Nerul MIDC, Navi Mumbai, built for businesses that plan ahead.",
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

  priceRange: "₹60 Lakhs – ₹1.5 Crore",
  possession: "December 2029",

  /** Footer credit — the agency delivering this site. */
  credit: "Zoot",
} as const;

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Amenities", href: "#amenities" },
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
  eyebrow: "Pure Commercial · Nerul MIDC",
  // Kept to two display lines at 1440px so the stat cards stay above the fold.
  title: "Commercial Spaces Built for Growth",
  // Hard break keeps the lead to two lines from `sm` upward.
  subtitle:
    "Offices and showrooms in Nerul MIDC, Navi Mumbai.\nCodename Magnitude by Reliable Realties.",
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
      value: "₹60 L",
      label: "Starting Price",
      note: "Up to ₹1.5 Cr",
    },
    {
      icon: "store",
      value: "Office",
      label: "& Showroom Units",
      note: "Pure Commercial",
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
  body: "Pure commercial offices and showrooms in the heart of Nerul MIDC.\nEfficient floor plates, strong frontage, and infrastructure planned\naround the way modern businesses actually work.",
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
    { icon: "store", label: "Office &\nShowroom" },
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
    body: "Every unit is planned around visibility, access, and the working day-so your business runs the way it should.",
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
      title: "Strategic Location",
      body: "Inside the established Nerul MIDC belt, minutes from Palm Beach Road, Seawoods and the Thane-Belapur corridor.",
    },
    {
      number: "02",
      title: "Flexible Unit Sizes",
      body: "Offices and showrooms across a range of layouts, so you take exactly the space your business needs today.",
    },
    {
      number: "03",
      title: "Quality Construction",
      body: "Considered specifications and finishes selected for durability, low maintenance and a long working life.",
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
  body: "Thoughtfully planned facilities that keep your teams, your clients and your operations moving-every single day.",
  items: [
    {
      icon: "concierge",
      title: "Reception & Concierge",
      body: "A staffed front desk that greets every visitor.",
      image: "/images/amenity-concierge.png",
      alt: "Reception desk with a concierge assisting a visitor",
    },
    {
      icon: "sofa",
      title: "Business Lounge",
      body: "Meet, wait and work between appointments.",
      image: "/images/amenity-lounge.png",
      alt: "Business lounge with soft lighting and deep seating",
    },
    {
      icon: "trees",
      title: "Landscaped Forecourt",
      body: "Green, open arrival space for the whole campus.",
      image: "/images/amenity-courtyard.png",
      alt: "Landscaped forecourt between commercial buildings",
    },
    {
      icon: "coffee",
      title: "Café & Dining Court",
      body: "On-site food and coffee, all working day.",
      image: "/images/why-thumb-1.png",
      alt: "Outdoor dining court with seating",
    },
    {
      icon: "sunset",
      title: "Open Terrace Deck",
      body: "Breakout space for informal meetings.",
      image: "/images/amenity-terrace.png",
      alt: "Open terrace deck overlooking the city at sunset",
    },
    {
      icon: "dumbbell",
      title: "Wellness & Break Room",
      body: "Space to reset in the middle of the day.",
      image: "/images/amenity-wellness.png",
      alt: "Wellness room opening onto a planted courtyard",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*                                 Unit plans                                 */
/* -------------------------------------------------------------------------- */

export const unitPlans = {
  eyebrow: "Unit Plans",
  title: "Efficient Layouts, Flexible Footprints",
  body: "Explore office and showroom configurations designed for visibility, circulation and everyday efficiency.",
  /** Label above the headline figure in the detail panel. */
  metricLabel: "Starting Price",
  units: [
    {
      id: "unit-a",
      name: "Unit A",
      type: "Showroom",
      price: "₹60 L onwards",
      heading: "Ground Floor Showroom",
      image: "/images/unit-plan.png",
      alt: "Layout plan for the ground floor showroom unit",
      features: [
        { icon: "store", label: "Street-Facing Frontage" },
        { icon: "maximize", label: "Double-Height Display" },
        { icon: "layers", label: "Mezzanine Ready" },
        { icon: "car", label: "Reserved Parking" },
      ],
    },
    {
      id: "unit-b",
      name: "Unit B",
      type: "Office Suite",
      price: "₹85 L onwards",
      heading: "Mid-Floor Office Suite",
      image: "/images/unit-plan.png",
      alt: "Layout plan for the mid-floor office suite",
      features: [
        { icon: "briefcase", label: "Open Workspace" },
        { icon: "layers", label: "Private Cabin" },
        { icon: "coffee", label: "Pantry & Washroom" },
        { icon: "car", label: "Reserved Parking" },
      ],
    },
    {
      id: "unit-c",
      name: "Unit C",
      type: "Corner Office",
      price: "₹1.5 Cr",
      heading: "Corner Office Floor",
      image: "/images/unit-plan.png",
      alt: "Layout plan for the corner office floor",
      features: [
        { icon: "briefcase", label: "Full-Floor Layout" },
        { icon: "layers", label: "Two Private Cabins" },
        { icon: "maximize", label: "Conference Room" },
        { icon: "car", label: "2 Reserved Bays" },
      ],
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
        "Codename Magnitude is a pure commercial project offering ground-floor showrooms and office suites across a range of layouts. Units are designed for strong frontage, efficient circulation and flexible fit-outs.",
    },
    {
      question: "What is the price range?",
      answer:
        "Units are priced between ₹60 Lakhs and ₹1.5 Crore depending on the floor, unit type, frontage and carpet area. Our team will share the current price sheet and applicable charges on enquiry.",
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
  body: "Have questions or want to see the units in person?\nOur team is just a call or WhatsApp away.\nWe'd love to hear from you!",
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
      "₹60 L – ₹80 L",
      "₹80 L – ₹1 Cr",
      "₹1 Cr – ₹1.25 Cr",
      "₹1.25 Cr – ₹1.5 Cr",
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
