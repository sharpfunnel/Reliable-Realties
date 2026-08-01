import Image from "next/image";

import { hero } from "@/lib/content";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Above-the-fold hero: full-bleed architectural photograph washed out by a
 * horizontal cream gradient, with the headline stack on the left, a floating
 * social-proof card top-right and three glass stat cards along the bottom.
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

          <SocialProofCard />
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

/** Floating "500+ happy homeowners" proof card pinned to the hero's top-right. */
function SocialProofCard() {
  const { proof } = hero;

  return (
    <Reveal
      delay={340}
      y={-20}
      className="glass-float hidden w-[249px] shrink-0 flex-col gap-3 rounded-3xl p-6 lg:flex"
    >
      <div className="flex items-center">
        {proof.avatars.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={34}
            height={34}
            className="relative size-[34px] rounded-full object-cover ring-2 ring-white/80"
            style={{ marginLeft: index === 0 ? 0 : -10 }}
          />
        ))}
        <span
          className="relative -ml-2.5 grid size-[34px] shrink-0 place-items-center rounded-full bg-gold text-[9px] font-bold text-white ring-2 ring-white/80"
          aria-hidden
        >
          {proof.count}
        </span>
      </div>

      <p className="font-display text-[32px] font-normal leading-[1.15] tracking-[-0.016em] text-ink">
        {proof.count}
      </p>
      <p className="body-base text-ink-soft">{proof.label}</p>

      <span aria-hidden className="h-px w-full bg-ink/10" />

      <p className="text-[15px] leading-[1.2] tracking-[0.08em] text-gold" aria-label="Rated 5 out of 5">
        <span aria-hidden>★★★★★</span>
      </p>
      <p className="body-sm text-ink-soft">{proof.note}</p>
    </Reveal>
  );
}
