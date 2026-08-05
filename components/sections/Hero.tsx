import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { hero, site } from "@/lib/content";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

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
 * Miniature, non-interactive preview of the contact form pinned to the
 * hero's top-right. Clicking it jumps straight to the real form.
 */
function ContactFormPreviewCard() {
  return (
    <Reveal
      delay={340}
      y={24}
      className="hidden w-[440px] shrink-0 lg:block lg:pt-24"
    >
      <Link
        href="#contact-form"
        aria-label="Jump to the enquiry form"
        className="group flex w-full flex-col rounded-[20px] bg-white/85 p-[30px] shadow-[var(--shadow-card)] backdrop-blur-[10px] transition-transform duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1"
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
          <span className="flex h-10 w-full items-center rounded-[10px] border border-ink/15 bg-white/60 px-3.5 text-sm text-ink/55">
            Full Name *
          </span>
          <span className="flex h-10 w-full items-center rounded-[10px] border border-ink/15 bg-white/60 px-3.5 text-sm text-ink/55">
            Phone Number *
          </span>
        </div>

        <div className="mt-4 flex items-start gap-2.5 text-xs leading-[1.2] text-ink/70">
          <span
            aria-hidden
            className="mt-0.5 size-4 shrink-0 rounded-[4px] border border-gold/60 bg-white/60"
          />
          <span>I agree to be contacted by {site.name} about this enquiry.</span>
        </div>

        <span className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-ink text-sm font-semibold text-white backdrop-blur-[9px] transition-colors duration-300 group-hover:bg-ink/90">
          Submit
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2}
          />
        </span>
      </Link>
    </Reveal>
  );
}
