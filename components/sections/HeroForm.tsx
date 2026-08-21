"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { hero, site } from "@/lib/content";
import { trackPixelLead } from "@/lib/meta/pixel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getDeviceInfo, getSessionInit } from "@/lib/track/client/device";
import { trackError } from "@/lib/track/client/errors";
import { getSessionId, getVisitorId } from "@/lib/track/client/ids";
import { isValidName, isValidPhone, sanitizeNameInput, sanitizePhoneInput } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Miniature preview of the contact form pinned to the hero's top-right.
 * Functionally mirrors the main enquiry form: submits straight to
 * /api/leads and redirects to the thank-you page on success.
 *
 * The only interactive piece of the hero — kept as the sole client
 * component in this section so the rest of the hero (headline, stats,
 * CTAs) ships and hydrates as static server-rendered markup.
 */
export function HeroForm() {
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
          formId: "hero-enquiry",
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
      onSubmit={handleSubmit}
      data-form-id="hero-enquiry"
      aria-label="Send us a message"
      className="group flex w-full flex-col rounded-[20px] bg-white/95 p-[30px] shadow-[var(--shadow-float)] ring-1 ring-inset ring-gold/25 backdrop-blur-[10px] transition-transform duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1"
    >
      <div className="mb-4 flex items-start gap-2 rounded-[12px] bg-gold/10 px-3 py-2.5">
        <Icon name="pin" className="mt-px size-4 shrink-0 text-gold" strokeWidth={1.6} />
        <h3 className="font-display text-[15px] font-normal leading-[1.25] tracking-[-0.01em] text-ink">
          {hero.formHeadline}
        </h3>
      </div>

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-2xl font-normal leading-[1.15] tracking-[-0.0125em] text-ink">
          Send Us a Message
        </h3>
        <ArrowUpRight
          aria-hidden
          className="mt-1 size-4 shrink-0 text-ink transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={2}
        />
      </div>
      <p className="body-sm mt-1 text-ink">
        Fill in your details and we&apos;ll get back to you shortly.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <label htmlFor="hero-full-name" className="sr-only">
          Full Name
        </label>
        <input
          id="hero-full-name"
          name="name"
          type="text"
          placeholder="Full Name *"
          required
          minLength={2}
          autoComplete="name"
          onChange={(e) => {
            const sanitized = sanitizeNameInput(e.target.value);
            if (sanitized !== e.target.value) e.target.value = sanitized;
          }}
          className="h-10 w-full rounded-[10px] border border-ink/15 bg-white/60 px-3.5 text-sm text-ink outline-none transition-colors duration-300 focus:border-gold"
        />
        <label htmlFor="hero-phone" className="sr-only">
          Phone Number
        </label>
        <input
          id="hero-phone"
          name="phone"
          type="tel"
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
          className="h-10 w-full rounded-[10px] border border-ink/15 bg-white/60 px-3.5 text-sm text-ink outline-none transition-colors duration-300 focus:border-gold"
        />
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-xs leading-[1.2] text-ink/70">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-4 shrink-0 appearance-none rounded-[4px] border border-gold/60 bg-white/60 transition-colors checked:border-gold checked:bg-gold"
        />
        <span>I agree to be contacted by {site.name} about this enquiry.</span>
      </label>

      <Button
        type="submit"
        disabled={status === "submitting"}
        className="mt-5 h-10 w-full rounded-[10px] text-sm font-semibold disabled:opacity-70"
      >
        {status === "submitting" ? "Sending…" : "Submit"}
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
