import Image from "next/image";

import { whyChoose } from "@/lib/content";
import { House } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

/**
 * Left: heading plus a three-image collage with a floating statement card.
 * Right: the four numbered value pillars separated by hairline rules.
 */
export function WhyChoose() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[548px_minmax(0,1fr)] lg:gap-10">
        {/* Collage column */}
        <div className="flex flex-col gap-[30px]">
          <SectionHeader
            eyebrow={whyChoose.eyebrow}
            title={whyChoose.title}
            className="max-w-[548px]"
          />

          <div className="relative lg:h-[503px]">
            <div className="grid aspect-[548/417] grid-cols-[318fr_220fr] gap-2.5 lg:absolute lg:inset-x-0 lg:top-0 lg:aspect-auto lg:h-[417px]">
              <CollageImage
                src={whyChoose.images.tall.src}
                alt={whyChoose.images.tall.alt}
                className="row-span-2 h-full"
              />
              <CollageImage
                src={whyChoose.images.topRight.src}
                alt={whyChoose.images.topRight.alt}
                delay={100}
              />
              <CollageImage
                src={whyChoose.images.bottomRight.src}
                alt={whyChoose.images.bottomRight.alt}
                delay={180}
              />
            </div>

            {/* Floating statement card */}
            <Reveal
              delay={240}
              y={34}
              className="glass-card relative z-10 -mt-16 mx-3 flex gap-4 rounded-2xl p-6 sm:mx-8 lg:absolute lg:left-[11%] lg:top-[259px] lg:mx-0 lg:mt-0 lg:w-[428px]"
            >
              <House
                aria-hidden
                className="mt-1 size-9 shrink-0 text-gold"
                strokeWidth={1.3}
              />
              <div className="flex flex-col gap-4">
                <h3 className="max-w-[314px] font-display text-[28px] font-normal leading-[1.15] tracking-[-0.011em] text-ink">
                  {whyChoose.card.title}
                </h3>
                <span aria-hidden className="h-px w-10 bg-gold" />
                <p className="body-sm max-w-[250px] text-ink">
                  {whyChoose.card.body}
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Pillars */}
        <ol className="flex flex-col">
          {whyChoose.pillars.map((pillar, index) => (
            <Reveal
              as="li"
              key={pillar.number}
              delay={index * 100}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6 border-t border-gold/25 py-10 first:border-t-0 first:pt-0 sm:gap-9 lg:py-[52px]"
            >
              <span
                aria-hidden
                className="font-display text-[clamp(2.5rem,5vw,4rem)] font-medium leading-[1.05] tracking-[-0.023em] text-gold"
              >
                {pillar.number}
              </span>
              <div className="border-l border-gold/50 pl-6 sm:pl-9">
                <h3 className="font-display text-[clamp(1.5rem,2.2vw,1.75rem)] font-normal leading-[1.15] tracking-[-0.011em] text-ink">
                  {pillar.title}
                </h3>
                <p className="body-sm mt-2 max-w-[420px] text-ink">
                  {pillar.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function CollageImage({
  src,
  alt,
  className,
  delay = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal
      delay={delay}
      y={30}
      className={`group relative min-h-[130px] overflow-hidden rounded-[20px] ${className ?? ""}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 45vw, 320px"
        className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-105"
      />
    </Reveal>
  );
}
