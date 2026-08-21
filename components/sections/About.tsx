import Image from "next/image";

import { about } from "@/lib/content";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

/**
 * Two-column introduction: copy, a pair of thumbnails and three glass
 * highlight chips on the left; a tall feature photograph on the right.
 * On desktop the chip row deliberately overflows its column so the last
 * chip overlaps the photograph, exactly as in the reference.
 */
export function About() {
  return (
    <Section id="about">
      <div className="grid items-stretch gap-10 lg:grid-cols-[548px_minmax(0,1fr)]">
        {/* Left column */}
        <div className="flex flex-col gap-[30px] lg:justify-between lg:pt-5">
          <SectionHeader
            eyebrow={about.eyebrow}
            title={about.title}
            body={about.body}
            bodyClassName="sm:whitespace-pre-line sm:max-w-none"
          />

          {/* Thumbnails */}
          <div className="grid grid-cols-2 gap-2.5">
            {about.thumbnails.map((thumb, index) => (
              <Reveal
                key={thumb.src}
                delay={index * 120}
                className="group relative aspect-[269/200] overflow-hidden rounded-[20px]"
              >
                <Image
                  src={thumb.src}
                  alt={thumb.alt}
                  fill
                  sizes="(max-width: 1024px) 45vw, 270px"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-105"
                />
              </Reveal>
            ))}
          </div>

          {/* Highlight chips */}
          <ul className="relative z-10 grid gap-4 sm:grid-cols-3 lg:w-[766px]">
            {about.highlights.map((item, index) => (
              <Reveal
                as="li"
                key={item.label}
                delay={index * 120}
                className="glass-card flex items-center gap-4 rounded-2xl px-5 py-6"
              >
                <Icon
                  name={item.icon as IconName}
                  className="size-9 shrink-0 text-gold"
                  strokeWidth={1.3}
                />
                <span className="flex flex-col">
                  {"value" in item && item.value ? (
                    <span className="text-[30px] font-light leading-[1] tracking-[-0.02em] text-ink">
                      {item.value}
                    </span>
                  ) : null}
                  <span className="body-base whitespace-pre-line text-ink">
                    {item.label}
                  </span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>

        {/* Feature photograph */}
        <Reveal
          delay={120}
          y={40}
          className="group relative min-h-[420px] overflow-hidden rounded-[20px] lg:min-h-[769px]"
        >
          <Image
            src={about.feature.src}
            alt={about.feature.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 612px"
            quality={90}
            className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
          />
        </Reveal>
      </div>
    </Section>
  );
}
