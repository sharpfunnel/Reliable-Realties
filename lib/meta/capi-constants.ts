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
