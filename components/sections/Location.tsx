import { location } from "@/lib/content";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";
import { LocationMap } from "./LocationMap";

/**
 * Location advantage: connectivity highlights beside an illustrated map,
 * with a drive-time strip spanning the full content width beneath.
 */
export function Location() {
  return (
    <Section containerClassName="flex flex-col gap-10">
      <div className="grid gap-10 lg:grid-cols-[428px_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <SectionHeader
            eyebrow={location.eyebrow}
            title={location.title}
            body={location.body}
            headingClassName="display-sm"
          />

          <ul className="flex flex-col">
            {location.advantages.map((advantage, index) => (
              <Reveal
                as="li"
                key={advantage.title}
                delay={index * 100}
                className="flex items-start gap-4 border-b border-ink/10 py-4 last:border-b-0"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-gold/30">
                  <Icon
                    name={advantage.icon as IconName}
                    className="size-5 text-gold"
                    strokeWidth={1.3}
                  />
                </span>
                <div>
                  <h3 className="body-base text-ink">{advantage.title}</h3>
                  <p className="body-xs mt-1 max-w-[290px] text-ink">
                    {advantage.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={140} y={34}>
          <LocationMap className="min-h-[320px] sm:min-h-[420px] lg:min-h-[520px]" />
        </Reveal>
      </div>

      {/* Drive times */}
      <Reveal y={26}>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 rounded-[20px] bg-white px-5 py-[30px] sm:grid-cols-3 lg:grid-cols-6">
          {location.distances.map((distance, index) => (
            <li
              key={distance.place}
              className={
                "flex flex-col items-center gap-2 text-center " +
                (index === 0 ? "" : "lg:border-l lg:border-ink/10")
              }
            >
              <Icon
                name={distance.icon as IconName}
                className="size-7 text-gold"
                strokeWidth={1.3}
              />
              <p className="body-lead text-ink">{distance.time}</p>
              <p className="body-xs text-ink">{distance.place}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}
