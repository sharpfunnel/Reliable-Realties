import Image from "next/image";

import { contact } from "@/lib/content";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";
import { ContactForm } from "@/components/sections/ContactForm";

/**
 * Server-rendered — only the enquiry form (`ContactForm`) needs the
 * browser, so it's the sole client-component island here.
 */
export function Contact() {
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

          <ContactForm />
        </Reveal>
      </div>
    </Section>
  );
}
