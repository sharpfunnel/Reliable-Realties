"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { hero, site } from "@/lib/content";
import { trackPixelLead } from "@/lib/meta/pixel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { getDeviceInfo, getSessionInit } from "@/lib/track/client/device";
import { getSessionId, getVisitorId } from "@/lib/track/client/ids";
import { isValidName, isValidPhone, sanitizeNameInput, sanitizePhoneInput } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Above-the-fold hero: full-bleed architectural photograph washed out by a
 * horizontal cream gradient, with the headline stack on the left, a floating
 * contact-form preview top-right and three glass stat cards along the bottom.
 */
export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden px-5 pt-[124px] pb-15 lg:min-h-[900px] lg:px-10 lg:pt-[100px]"
    >
      {/* Backdrop */}
      <Image
        src="/images/hero-building.png"
        alt="Contemporary commercial building glowing at golden hour"
        fill
        priority
        sizes="100vw"
        quality={90}
        className="-z-20 object-cover object-[70%_center]"
      />

      {/* Horizontal wash so the headline stays legible over the photograph */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 w-full lg:w-[70%]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #f5f1eb 0%, rgba(245,241,235,0.92) 35%, rgba(245,241,235,0.55) 65%, rgba(245,241,235,0) 100%)",
        }}
      />
      {/* Bottom fade into the page background */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(245,241,235,0) 0%, rgba(245,241,235,0) 77%, #f5f1eb 100%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1200px]">
        <div className="flex items-start justify-between gap-10">
          {/* Headline stack */}
          <div className="flex max-w-[630px] flex-col gap-6 pt-2 lg:pt-[58px]">
            <Reveal y={16} blur={4}>
              <Eyebrow>{hero.eyebrow}</Eyebrow>
            </Reveal>

            <Reveal delay={90} y={34}>
              <h1 className="display-xl text-ink">{hero.title}</h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="body-lead max-w-[470px] text-ink-soft sm:max-w-none sm:whitespace-pre-line">
                {hero.subtitle}
              </p>
            </Reveal>

            <Reveal delay={260} className="flex flex-col gap-3 pt-2 sm:flex-row">
              <ButtonLink href={hero.primaryCta.href} variant="dark" data-cta-id="hero-primary">
                {hero.primaryCta.label}
              </ButtonLink>
              <ButtonLink
                href={hero.secondaryCta.href}
                variant="outline"
                icon="right"
                data-cta-id="hero-secondary"
              >
                {hero.secondaryCta.label}
              </ButtonLink>
            </Reveal>
          </div>

          <ContactFormPreviewCard />
        </div>

        {/* Stat cards */}
        <ul className="mt-12 grid max-w-[740px] gap-3 sm:grid-cols-3 lg:mt-15">
          {hero.stats.map((stat, index) => (
            <Reveal
              as="li"
              key={stat.label}
              delay={index * 110}
              y={34}
              className="glass-card flex flex-col gap-2.5 rounded-3xl p-6"
            >
              <Icon
                name={stat.icon as IconName}
                className="size-7 text-gold"
                strokeWidth={1.4}
              />
              <p className="font-display text-[32px] font-normal leading-[1.15] tracking-[-0.016em] text-ink">
                {stat.value}
              </p>
              <p className="body-sm text-ink-soft">{stat.label}</p>
              <span aria-hidden className="mt-1 h-px w-6 bg-gold/70" />
              <p className="body-sm text-ink-muted">{stat.note}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Miniature preview of the contact form pinned to the hero's top-right.
 * Functionally mirrors the main enquiry form: submits straight to
 * /api/leads and redirects to the thank-you page on success.
 */
function ContactFormPreviewCard() {
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
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <Reveal
      delay={340}
      y={24}
      className="hidden w-[440px] shrink-0 lg:block lg:pt-24"
    >
      <form
        onSubmit={handleSubmit}
        data-form-id="hero-enquiry"
        aria-label="Send us a message"
        className="group flex w-full flex-col rounded-[20px] bg-white/95 p-[30px] shadow-[var(--shadow-float)] ring-1 ring-inset ring-gold/25 backdrop-blur-[10px] transition-transform duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1"
      >
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
    </Reveal>
  );
}
