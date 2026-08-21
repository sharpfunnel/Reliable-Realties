"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { contact } from "@/lib/content";
import { trackPixelLead } from "@/lib/meta/pixel";
import { Button } from "@/components/ui/Button";
import { getDeviceInfo, getSessionInit } from "@/lib/track/client/device";
import { trackError } from "@/lib/track/client/errors";
import { getSessionId, getVisitorId } from "@/lib/track/client/ids";
import { isValidName, isValidPhone, sanitizeNameInput, sanitizePhoneInput } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * The contact section's enquiry form — the only interactive piece of
 * `Contact`, kept as its own client-component island so the section
 * heading, detail list and feature photograph stay server-rendered.
 */
export function ContactForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("submitting");
    setError(null);

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
    if (!data.get("consent")) {
      setError("Please fill in all required fields.");
      setStatus("error");
      return;
    }

    try {
      const [clientId] = getSessionId();
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: "contact-enquiry",
          name,
          phone,
          fingerprint: getVisitorId(),
          clientId,
          device: getDeviceInfo(),
          sessionInit: getSessionInit(),
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { leadId?: string; error?: string }
        | null;

      if (!res.ok) {
        throw new Error(payload?.error ?? "Submission failed");
      }

      // Browser half of the Lead conversion. The lead id doubles as the
      // eventID, pairing this with the server-side CAPI event so Meta counts
      // one conversion rather than two.
      if (payload?.leadId) trackPixelLead(payload.leadId);

      form.reset();
      setStatus("success");
      router.push(payload?.leadId ? `/thank-you?leadId=${payload.leadId}` : "/thank-you");
    } catch (err) {
      // Surfaces in /admin/errors — without this a failed submit (in-app
      // browsers especially) leaves no trace anywhere.
      console.error("Lead submission failed", err);
      trackError("lead_submit", err);
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form
      id="contact-form"
      onSubmit={handleSubmit}
      data-form-id="contact-enquiry"
      noValidate={false}
      className={cn(
        "scroll-mt-24 rounded-[20px] bg-white/85 p-6 backdrop-blur-[10px] sm:p-[30px]",
        "shadow-[var(--shadow-card)]",
        "-mt-16 mx-3 sm:mx-6 lg:absolute lg:inset-x-5 lg:bottom-5 lg:mx-0 lg:mt-0",
      )}
    >
      <h3 className="font-display text-2xl font-normal leading-[1.15] tracking-[-0.0125em] text-ink">
        {contact.form.title}
      </h3>
      <p className="body-sm mt-1 text-ink">{contact.form.subtitle}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          id="full-name"
          name="name"
          label="Full Name"
          placeholder="Full Name *"
          required
          minLength={2}
          autoComplete="name"
          onChange={(e) => {
            const sanitized = sanitizeNameInput(e.target.value);
            if (sanitized !== e.target.value) e.target.value = sanitized;
          }}
        />
        <Field
          id="phone"
          name="phone"
          type="tel"
          label="Phone Number"
          placeholder="Phone Number *"
          required
          pattern="\+?(?=(?:\D*\d){10,13}\D*$)[0-9\s\-()]+"
          title="Enter a valid phone number (10 digits, with an optional country code)"
          maxLength={16}
          inputMode="tel"
          autoComplete="tel"
          onChange={(e) => {
            const sanitized = sanitizePhoneInput(e.target.value);
            if (sanitized !== e.target.value) e.target.value = sanitized;
          }}
        />
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-xs leading-[1.2] text-ink/70">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-4 shrink-0 appearance-none rounded-[4px] border border-gold/60 bg-white/60 transition-colors checked:border-gold checked:bg-gold"
        />
        <span>{contact.form.consent}</span>
      </label>

      <Button
        type="submit"
        disabled={status === "submitting"}
        className="mt-5 h-10 w-full rounded-[10px] text-sm font-semibold disabled:opacity-70"
      >
        {status === "submitting" ? "Sending…" : contact.form.submit}
      </Button>

      <p
        aria-live="polite"
        className={cn(
          "mt-3 text-xs",
          status === "success" && "text-gold",
          status === "error" && "text-red-600",
        )}
      >
        {status === "success"
          ? "Thank you — our team will be in touch shortly."
          : status === "error"
            ? error ?? "Something went wrong. Please try again."
            : ""}
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  ...props
}: React.ComponentPropsWithoutRef<"input"> & { id: string; label: string }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        className="h-10 w-full rounded-[10px] border border-ink/15 bg-white/60 px-3.5 text-sm text-ink outline-none transition-colors duration-300 focus:border-gold"
        {...props}
      />
    </div>
  );
}
