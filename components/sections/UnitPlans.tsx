"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { unitPlans } from "@/lib/content";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

/**
 * Interactive unit-plan browser. The unit list acts as a tab list and the
 * detail panel is keyed on the active unit so it re-runs its fade-in
 * transition on every switch.
 */
export function UnitPlans() {
  type UnitId = (typeof unitPlans.units)[number]["id"];
  const [activeId, setActiveId] = useState<UnitId>(unitPlans.units[0].id);
  const active =
    unitPlans.units.find((unit) => unit.id === activeId) ?? unitPlans.units[0];

  return (
    <Section id="unit-plans" containerClassName="flex flex-col gap-10">
      <div className="grid gap-10 lg:grid-cols-[428px_minmax(0,1fr)]">
        {/* Selector */}
        <div className="flex flex-col gap-8">
          <SectionHeader
            eyebrow={unitPlans.eyebrow}
            title={unitPlans.title}
            body={unitPlans.body}
            headingClassName="display-sm"
          />

          <div
            role="tablist"
            aria-label="Unit plans"
            className="flex flex-col gap-2.5"
          >
            {unitPlans.units.map((unit) => {
              const selected = unit.id === active.id;
              return (
                <button
                  key={unit.id}
                  type="button"
                  role="tab"
                  id={`tab-${unit.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${unit.id}`}
                  onClick={() => setActiveId(unit.id)}
                  className={cn(
                    "group flex h-[46px] items-center gap-4 rounded-[10px] px-5 text-left",
                    "transition-colors duration-300 ease-[var(--ease-out-soft)]",
                    selected ? "bg-ink text-white" : "text-ink hover:bg-white/60",
                  )}
                >
                  <span className="body-base shrink-0">{unit.type}</span>
                  <span className="body-base ml-auto shrink-0 tabular-nums">
                    {unit.area}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={1.75}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <Reveal
          delay={120}
          y={30}
          className="rounded-[20px] bg-shell px-5 py-10 sm:px-8"
        >
          <div
            key={active.id}
            role="tabpanel"
            id={`panel-${active.id}`}
            aria-labelledby={`tab-${active.id}`}
            className="grid animate-[fade-up_.5s_var(--ease-out-soft)_both] gap-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10"
          >
            <div className="flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-[0.083em] text-gold">
                {active.name}
              </p>
              <h3 className="mt-3 font-display text-2xl font-medium leading-[1.15] tracking-[-0.0125em] text-ink">
                {active.heading}
              </h3>

              <span aria-hidden className="my-5 h-px w-full bg-ink/10" />

              <ul className="flex flex-col gap-[22px]">
                {active.features.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-3">
                    <Icon
                      name={feature.icon as IconName}
                      className="size-[22px] shrink-0 text-gold"
                      strokeWidth={1.3}
                    />
                    <span className="body-sm text-ink">{feature.label}</span>
                  </li>
                ))}
              </ul>

              <span aria-hidden className="my-5 h-px w-full bg-ink/10" />

              <p className="body-base text-ink">{unitPlans.metricLabel}</p>
              <p className="font-display text-[32px] font-normal leading-[1.15] tracking-[-0.016em] text-ink">
                {active.area}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-xl bg-white md:min-h-[440px]">
                <Image
                  src={active.image}
                  alt={active.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 442px"
                  className="object-contain p-2"
                />
              </div>
              <Link
                href="#floor-plans"
                className="group inline-flex items-center gap-1.5 self-start text-[13px] text-gold underline-offset-4 transition-colors hover:underline"
              >
                {unitPlans.planLinkLabel}
                <ArrowRight
                  aria-hidden
                  className="size-3.5 transition-transform duration-300 group-hover:translate-x-1"
                  strokeWidth={2}
                />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Vertical mix of the tower, read off the schematic section drawing */}
      <Reveal y={26}>
        <ul className="grid gap-x-5 gap-y-6 rounded-[20px] bg-white px-5 py-[30px] sm:grid-cols-2 lg:grid-cols-5">
          {unitPlans.stack.map((level, index) => (
            <li
              key={level.floors}
              className={
                "flex flex-col items-center gap-1.5 px-2 text-center " +
                (index === 0 ? "" : "lg:border-l lg:border-ink/10")
              }
            >
              <span className="text-[11px] uppercase tracking-[0.14em] text-gold">
                Floor {level.floors}
              </span>
              <span className="body-base text-ink">{level.use}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}
