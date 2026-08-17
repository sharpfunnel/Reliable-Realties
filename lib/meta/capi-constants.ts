/**
 * Shared between the server-side payload builder and the admin console's
 * client component, so this module must stay free of `server-only` and of any
 * Node built-ins.
 */

export const EVENT_NAMES = [
  "Lead",
  "CompleteRegistration",
  "Contact",
  "Schedule",
  "SubmitApplication",
  "ViewContent",
  "InitiateCheckout",
  "Purchase",
] as const;

export const ACTION_SOURCES = [
  "website",
  "phone_call",
  "chat",
  "email",
  "app",
  "system_generated",
  "other",
] as const;

// ---------------------------------------------------------------------------
// Manual send (the "Send" modal on /admin/leads)
// ---------------------------------------------------------------------------

/**
 * The conversion types an admin can fire by hand against a lead. `Custom` is
 * the escape hatch: the event name comes from a free-text field instead.
 *
 * `value` is what each type means when a conversion value is filled in — shown
 * as the field hint so nobody has to guess what they are pricing.
 */
export const CAPI_EVENT_TYPES = [
  { value: "Purchase", label: "Purchase", hint: "A booking or sale closed." },
  { value: "Lead", label: "Lead", hint: "Re-fires the event sent on form submit." },
  { value: "Subscribe", label: "Subscribe", hint: "Signed up for a recurring plan." },
  { value: "CompleteRegistration", label: "Registration", hint: "Completed a signup or registration." },
  { value: "StartTrial", label: "Start Trial", hint: "Began a trial or provisional booking." },
  { value: "Custom", label: "Custom…", hint: "Any other event name configured on the Pixel." },
] as const;

export type CapiEventType = (typeof CAPI_EVENT_TYPES)[number]["value"];

/** Meta caps event names at 50 characters and allows no punctuation beyond `_`. */
export const CUSTOM_EVENT_NAME_PATTERN = /^[A-Za-z0-9_]{1,50}$/;

/**
 * What the modal collects. Deliberately small: the lead is referenced by id and
 * everything else about it (email, phone, ip, fbclid, location) is re-read
 * server-side, so the client can never dictate whose data gets sent to Meta.
 */
export type ManualCapiOptions = {
  eventType: CapiEventType;
  /** Only read when `eventType` is `Custom`. */
  customEventName?: string;
  /** Conversion value. Omitted from `custom_data` when undefined. */
  value?: number;
  currency?: string;
  /** Becomes the CAPI `event_id`, for dedup against a client-side Pixel event. */
  orderId?: string;
};

// ---------------------------------------------------------------------------
// Session quality grading (the "Send" flow on /admin/sessions)
// ---------------------------------------------------------------------------

/**
 * How an admin grades a visitor before reporting them to Meta.
 *
 * Meta cannot read time-on-page or scroll depth, and it would not understand
 * them if it could — it learns from *who* converted and *what they were worth*.
 * So engagement never travels as a parameter: the operator reads the session's
 * signals, picks a grade, and the grade becomes `custom_data.value`. That
 * number is the entire message, and it is what value-optimised campaigns bid
 * against.
 *
 * The amounts are deliberately spread wide. Grades that sit close together give
 * the optimiser almost nothing to separate, and a flat value teaches it nothing
 * at all — which is the problem this whole flow exists to fix.
 */
export const SESSION_QUALITY_GRADES = [
  {
    value: "hot",
    label: "Hot",
    conversionValue: 5000,
    hint: "Deep, deliberate visit — read the detail, returned, or engaged the form.",
  },
  {
    value: "warm",
    label: "Warm",
    conversionValue: 1500,
    hint: "Real interest but shallow — worth having more of, not a buyer yet.",
  },
  {
    value: "cold",
    label: "Cold",
    conversionValue: 200,
    hint: "Skimmed and left. Reported so Meta learns to find fewer like this.",
  },
] as const;

export type SessionQualityGrade = (typeof SESSION_QUALITY_GRADES)[number]["value"];

export function qualityGrade(value: string | null | undefined) {
  return SESSION_QUALITY_GRADES.find((grade) => grade.value === value);
}

/**
 * The event name a graded session is reported under by default.
 *
 * Not `Lead` — a session that never submitted the form is not a lead, and
 * mixing the two would corrupt the signal the live sender already provides.
 * A distinct custom event can be optimised for, or ignored, independently.
 */
export const DEFAULT_SESSION_EVENT_NAME = "QualifiedVisit";

/**
 * What the session modal collects. Like `ManualCapiOptions` this carries no
 * identity: the session is referenced by id and every identifier (fbp, fbc, ip,
 * user agent, and any linked lead's email/phone) is re-read server-side.
 */
export type ManualSessionCapiOptions = ManualCapiOptions & {
  quality: SessionQualityGrade;
};
