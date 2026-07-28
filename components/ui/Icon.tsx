import {
  Archive,
  Bath,
  BedDouble,
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  Car,
  Coffee,
  ConciergeBell,
  Dumbbell,
  Hospital,
  House,
  Layers,
  LayoutGrid,
  Mail,
  MapPin,
  MapPinHouse,
  Maximize,
  Move,
  Phone,
  Plane,
  Quote,
  Ruler,
  Send,
  ShoppingBasket,
  Sofa,
  Store,
  Sunset,
  TramFront,
  Trees,
  Utensils,
  Wallet,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * Central icon registry. Section data references icons by string key so the
 * content layer stays free of component imports.
 */
const ICONS = {
  house: House,
  grid: LayoutGrid,
  pin: MapPinHouse,
  dumbbell: Dumbbell,
  waves: Waves,
  sofa: Sofa,
  trees: Trees,
  concierge: ConciergeBell,
  sunset: Sunset,
  coffee: Coffee,
  utensils: Utensils,
  store: Store,
  wallet: Wallet,
  briefcase: Briefcase,
  layers: Layers,
  maximize: Maximize,
  ruler: Ruler,
  bed: BedDouble,
  bath: Bath,
  car: Car,
  move: Move,
  send: Send,
  archive: Archive,
  book: BookOpen,
  hospital: Hospital,
  basket: ShoppingBasket,
  tram: TramFront,
  building: Building2,
  plane: Plane,
  phone: Phone,
  mail: Mail,
  mapPin: MapPin,
  calendar: CalendarDays,
  calendarCheck: CalendarCheck,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS | "whatsapp";

export function Icon({
  name,
  className,
  strokeWidth = 1.5,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  // WhatsApp is a brand mark, not part of the lucide set.
  if (name === "whatsapp") return <WhatsAppIcon className={className} />;
  const Component = ICONS[name];
  return <Component aria-hidden className={className} strokeWidth={strokeWidth} />;
}

/** WhatsApp glyph, drawn to match the stroke weight of the lucide icons. */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M3.5 20.5 4.8 16a8.2 8.2 0 1 1 3.2 3.2l-4.5 1.3Z" />
      <path d="M9 9.2c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.2 0 .4-.1.6l-.4.5c-.1.2-.2.3-.1.5a5.4 5.4 0 0 0 2.5 2.2c.2.1.4 0 .5-.1l.5-.6c.2-.2.3-.2.5-.1l1.4.7c.2.1.4.2.4.4a1.8 1.8 0 0 1-1.3 1.6c-.6.1-1.3.2-3.2-.7a7.6 7.6 0 0 1-3.2-3.3c-.6-1.1-.5-2 .2-2.7Z" />
    </svg>
  );
}

/* Brand marks are no longer bundled with lucide, so they live here as
   minimal inline paths. */
export function SocialIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };

  switch (name) {
    case "Facebook":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.25" />
          <path d="M14.8 8.6h-1.3a1.6 1.6 0 0 0-1.6 1.6v11" />
          <path d="M9.9 13.4h4.5" />
        </svg>
      );
    case "Instagram":
      return (
        <svg {...common}>
          <rect width="20" height="20" x="2" y="2" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <path d="M17.5 6.5h.01" />
        </svg>
      );
    case "Pinterest":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.25" />
          <path d="M10.6 21.2c-.35-1.4-.1-2.9.1-3.7l1.35-5.6" />
          <path d="M9.6 11c-.55-2.4 1-4.5 3.4-4.5 2.1 0 3.6 1.4 3.6 3.5 0 2.6-1.4 4.5-3.3 4.5-1 0-1.75-.8-1.5-1.8" />
        </svg>
      );
    case "WhatsApp":
      return <WhatsAppIcon className={className} />;
    case "YouTube":
      return (
        <svg {...common}>
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8Z" />
          <path d="m10 15 5-3-5-3Z" />
        </svg>
      );
    default:
      return null;
  }
}

/** Decorative quotation mark used on testimonial cards. */
export function QuoteMark({ className }: { className?: string }) {
  return <Quote aria-hidden className={className} strokeWidth={1.5} />;
}
