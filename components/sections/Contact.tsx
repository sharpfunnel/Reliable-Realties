"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { contact } from "@/lib/content";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Contact section: contact details on the left, a frosted enquiry form
 * floating over a photograph on the right.
 *
 * The submit handler is intentionally transport-agnostic — swap the
 * `simulateSend` call for a server action or API route when a backend exists.
 */
export function Contact() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("submitting");

    try {
      // Placeholder for the real submission endpoint.
      await new Promise((resolve) => setTimeout(resolve, 700));
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Section id="contact">
      <div className="grid items-center gap-12 lg:grid-cols-[471px_minmax(0,1fr)] lg:gap-[110px]">
        {/* Details */}
        <div className="flex flex-col gap-6">
          <SectionHeader
            eyebrow={contact.eyebrow}
            title={contact.title}
            body={contact.body}
            headingClassName="display-sm"
            bodyClassName="sm:whitespace-pre-line sm:max-w-none"
          />

          <ul className="mt-2 flex flex-col gap-[18px]">
            {contact.details.map((detail, index) => (
              <Reveal
                as="li"
                key={detail.label}
                delay={index * 90}
                y={18}
                className="flex items-start gap-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-gold/30">
                  <Icon
                    name={detail.icon as IconName}
                    className="size-4 text-gold"
                    strokeWidth={1.4}
                  />
                </span>
                <span className="flex flex-col">
                  <span className="text-[10px] leading-[1.2] text-ink">
                    {detail.label}
                  </span>
                  {"href" in detail && detail.href ? (
                    <a
                      href={detail.href}
                      target={"external" in detail && detail.external ? "_blank" : undefined}
                      rel={
                        "external" in detail && detail.external
                          ? "noreferrer noopener"
                          : undefined
                      }
                      className="body-sm font-normal text-ink transition-colors hover:text-gold"
                    >
                      {detail.value}
                    </a>
                  ) : (
                    <span className="body-sm whitespace-pre-line font-normal text-ink">
                      {detail.value}
                    </span>
                  )}
                </span>
              </Reveal>
            ))}
          </ul>
        </div>

        {/* Form over image */}
        <Reveal delay={120} y={34} className="relative">
          <div className="relative min-h-[420px] overflow-hidden rounded-[20px] lg:min-h-[720px]">
            <Image
              src={contact.image.src}
              alt={contact.image.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 677px"
              quality={85}
              className="object-cover"
            />
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate={false}
            className={cn(
              "rounded-[20px] bg-white/85 p-6 backdrop-blur-[10px] sm:p-[30px]",
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
                autoComplete="name"
              />
              <Field
                id="phone"
                name="phone"
                type="tel"
                label="Phone Number"
                placeholder="Phone Number *"
                required
                autoComplete="tel"
              />
              <Field
                id="email"
                name="email"
                type="email"
                label="Email Address"
                placeholder="Email Address *"
                required
                autoComplete="email"
              />

              <div className="flex flex-col">
                <label htmlFor="budget" className="sr-only">
                  {contact.form.budgetLabel}
                </label>
                <select
                  id="budget"
                  name="budget"
                  defaultValue=""
                  className="h-10 w-full rounded-[10px] border border-ink/15 bg-white/60 px-3.5 text-sm text-ink outline-none transition-colors duration-300 focus:border-gold"
                >
                  <option value="" disabled>
                    {contact.form.budgetLabel}
                  </option>
                  {contact.form.budgets.map((budget) => (
                    <option key={budget} value={budget}>
                      {budget}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="message" className="sr-only">
                Your message
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                placeholder="Describe your ideas, needs, or questions..."
                className="w-full resize-none rounded-[10px] border border-ink/15 bg-white/60 p-3.5 text-sm text-ink outline-none transition-colors duration-300 focus:border-gold"
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
                  ? "Something went wrong. Please try again."
                  : ""}
            </p>
          </form>
        </Reveal>
      </div>
    </Section>
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
