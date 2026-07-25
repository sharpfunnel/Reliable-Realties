import Image from "next/image";

import { amenities } from "@/lib/content";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

/**
 * Amenity gallery — photo cards with an inset frosted label pinned to the
 * bottom edge. Images zoom gently and labels lift on hover.
 */
export function Amenities() {
  return (
    <Section id="amenities">
      <div className="flex flex-col gap-15">
        <SectionHeader
          eyebrow={amenities.eyebrow}
          title={amenities.title}
          body={amenities.body}
          className="max-w-[630px]"
        />

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {amenities.items.map((item, index) => (
            <Reveal
              as="li"
              key={item.title}
              delay={(index % 3) * 120}
              y={36}
              className="group relative aspect-[387/350] overflow-hidden rounded-[20px] p-2.5"
            >
              <Image
                src={item.image}
                alt={item.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 390px"
                className="-z-10 object-cover transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.06]"
              />

              <div className="glass-card absolute inset-x-2.5 bottom-2.5 flex items-center gap-4 rounded-xl p-3.5 transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:-translate-y-1">
                <Icon
                  name={item.icon as IconName}
                  className="size-7 shrink-0 text-gold"
                  strokeWidth={1.3}
                />
                <div className="min-w-0">
                  <h3 className="body-base truncate text-ink">{item.title}</h3>
                  <p className="body-xs text-ink">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
