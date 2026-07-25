import Image from "next/image";

import { testimonials } from "@/lib/content";
import { QuoteMark } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";

type Testimonial = (typeof testimonials.items)[number];

/**
 * Two infinite marquee rows travelling in opposite directions. Each row
 * renders its cards twice so the CSS translate can loop seamlessly at -50%.
 * Hovering (or focusing a card) pauses both tracks.
 */
export function Testimonials() {
  return (
    <Section id="testimonials" containerClassName="flex flex-col gap-10">
      <SectionHeader
        eyebrow={testimonials.eyebrow}
        title={testimonials.title}
        body={testimonials.body}
        align="center"
        headingClassName="display-md"
        className="mx-auto max-w-[620px]"
      />

      <div className="marquee marquee-mask -mx-5 flex flex-col gap-5 lg:-mx-10">
        <MarqueeRow items={testimonials.items} direction="left" duration={70} />
        <MarqueeRow items={testimonials.items} direction="right" duration={80} />
      </div>
    </Section>
  );
}

function MarqueeRow({
  items,
  direction,
  duration,
}: {
  items: readonly Testimonial[];
  direction: "left" | "right";
  duration: number;
}) {
  return (
    <div className="overflow-hidden">
      <ul
        className={`marquee-track marquee-track--${direction}`}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {[...items, ...items].map((item, index) => (
          <TestimonialCard
            key={`${item.name}-${index}`}
            item={item}
            hidden={index >= items.length}
          />
        ))}
      </ul>
    </div>
  );
}

function TestimonialCard({
  item,
  hidden,
}: {
  item: Testimonial;
  hidden: boolean;
}) {
  return (
    <li
      // The duplicated half is decorative — hide it from assistive tech.
      aria-hidden={hidden || undefined}
      className="flex w-[300px] shrink-0 flex-col gap-6 rounded-3xl bg-white p-8 sm:w-[338px]"
    >
      <QuoteMark className="size-7 text-gold" />

      <blockquote className="body-base flex-1 text-ink">
        {item.quote}
      </blockquote>

      <span aria-hidden className="h-px w-full bg-ink/10" />

      <figcaption className="flex items-center gap-3">
        <Image
          src={item.avatar}
          alt=""
          width={46}
          height={46}
          className="size-[46px] shrink-0 rounded-full object-cover"
        />
        <span className="flex flex-col">
          <span className="text-base leading-[1.55] text-forest">
            {item.name}
          </span>
          <span className="text-[13px] leading-[1.35] text-forest/70">
            {item.role}
          </span>
        </span>
      </figcaption>
    </li>
  );
}
