"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { faq } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

/**
 * Single-open accordion. Panels animate with a `grid-template-rows`
 * transition so the height is animatable without measuring the DOM.
 */
export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Section id="faq" className="py-16" containerClassName="flex flex-col gap-10">
      <SectionHeader
        eyebrow={faq.eyebrow}
        title={faq.title}
        body={faq.body}
        align="center"
        headingClassName="display-md"
        className="mx-auto max-w-[740px] gap-3.5"
      />

      <div className="mx-auto flex w-full max-w-[740px] flex-col gap-5">
        {faq.items.map((item, index) => {
          const open = openIndex === index;
          return (
            <Reveal
              key={item.question}
              delay={Math.min(index, 4) * 60}
              y={18}
              blur={3}
              className="overflow-hidden rounded-[14px] bg-white"
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`faq-panel-${index}`}
                  id={`faq-trigger-${index}`}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left sm:px-[30px]"
                >
                  <span className="body-lead flex-1 text-ink">
                    {item.question}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full bg-gold text-white",
                      "transition-transform duration-500 ease-[var(--ease-out-soft)]",
                      open && "rotate-45",
                    )}
                  >
                    <Plus className="size-5" strokeWidth={2} />
                  </span>
                </button>
              </h3>

              <div
                id={`faq-panel-${index}`}
                role="region"
                aria-labelledby={`faq-trigger-${index}`}
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-out-soft)]",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="body-sm px-5 pb-5 pr-14 text-ink-soft sm:px-[30px] sm:pr-20">
                    {item.answer}
                  </p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
