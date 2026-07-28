"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { planGallery } from "@/lib/content";
import { Reveal } from "@/components/ui/Reveal";
import { Section, SectionHeader } from "@/components/ui/Section";

type Slide = (typeof planGallery.slides)[number];

/**
 * Architectural drawing carousel.
 *
 * Built on native horizontal scrolling with CSS scroll-snap, so touch,
 * trackpad and keyboard all work without a gesture library. The active index
 * is derived from scroll position rather than owned by React, which keeps the
 * controls in sync however the user moves the track.
 *
 * Selecting a sheet opens it in a full-screen dialog at source resolution —
 * essential for drawings this dense.
 */
export function PlanGallery() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const total = planGallery.slides.length;

  /**
   * Derive the active slide from scroll position — the leading edge, so the
   * carousel reads as "01" on load rather than whichever sheet happens to sit
   * under the midpoint.
   */
  const syncActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slides = Array.from(track.children) as HTMLElement[];
    if (!slides.length) return;
    const base = slides[0].offsetLeft;
    let nearest = 0;
    let smallest = Infinity;
    slides.forEach((slide, index) => {
      const distance = Math.abs(slide.offsetLeft - base - track.scrollLeft);
      if (distance < smallest) {
        smallest = distance;
        nearest = index;
      }
    });
    setActive(nearest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    syncActive();
    track.addEventListener("scroll", syncActive, { passive: true });
    window.addEventListener("resize", syncActive);
    return () => {
      track.removeEventListener("scroll", syncActive);
      window.removeEventListener("resize", syncActive);
    };
  }, [syncActive]);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[index] as HTMLElement | undefined;
    const first = track.children[0] as HTMLElement | undefined;
    if (!slide || !first) return;
    track.scrollTo({
      left: slide.offsetLeft - first.offsetLeft,
      behavior: "smooth",
    });
  }, []);

  const step = (delta: number) =>
    scrollTo(Math.min(total - 1, Math.max(0, active + delta)));

  /* Lightbox keyboard handling: Escape closes, arrows page through. */
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight")
        setLightbox((i) => (i === null ? i : Math.min(total - 1, i + 1)));
      if (event.key === "ArrowLeft")
        setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, total]);

  return (
    <Section id="floor-plans" containerClassName="flex flex-col gap-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow={planGallery.eyebrow}
          title={planGallery.title}
          body={planGallery.body}
          headingClassName="display-sm"
          className="max-w-[560px]"
        />

        <Reveal delay={200} className="flex shrink-0 items-center gap-3">
          <a
            href={planGallery.pdfHref}
            download
            className="group inline-flex h-[46px] items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium leading-none text-white transition-[background-color,transform] duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:bg-ink/90"
          >
            <Download aria-hidden className="size-4" strokeWidth={1.75} />
            {planGallery.pdfLabel}
          </a>
        </Reveal>
      </div>

      <Reveal y={30} className="flex flex-col gap-6">
        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-2xl leading-none text-ink">
            <span className="text-gold">
              {String(active + 1).padStart(2, "0")}
            </span>
            <span className="text-ink/30"> / {String(total).padStart(2, "0")}</span>
          </p>

          <div className="flex items-center gap-2">
            <ArrowButton
              label="Previous plan"
              onClick={() => step(-1)}
              disabled={active === 0}
            >
              <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden />
            </ArrowButton>
            <ArrowButton
              label="Next plan"
              onClick={() => step(1)}
              disabled={active === total - 1}
            >
              <ChevronRight className="size-5" strokeWidth={1.75} aria-hidden />
            </ArrowButton>
          </div>
        </div>

        {/* Track */}
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Architectural floor plans"
        >
          <ul
            ref={trackRef}
            className={cn(
              "flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2",
              // Hide the native scrollbar; the buttons and dots drive it.
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {planGallery.slides.map((slide, index) => (
              <li
                key={slide.src}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${total}: ${slide.title}`}
                className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]"
              >
                <PlanCard
                  slide={slide}
                  index={index}
                  onOpen={() => setLightbox(index)}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Dots */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {planGallery.slides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => scrollTo(index)}
              aria-label={`Go to ${slide.title}`}
              aria-current={index === active}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 ease-[var(--ease-out-soft)]",
                index === active
                  ? "w-7 bg-gold"
                  : "w-1.5 bg-ink/20 hover:bg-ink/40",
              )}
            />
          ))}
        </div>

        <p className="text-center text-xs text-ink-muted">
          {planGallery.disclaimer}
        </p>
      </Reveal>

      {lightbox !== null ? (
        <Lightbox
          index={lightbox}
          onClose={() => setLightbox(null)}
          onStep={(delta) =>
            setLightbox((i) =>
              i === null ? i : Math.min(total - 1, Math.max(0, i + delta)),
            )
          }
        />
      ) : null}
    </Section>
  );
}

function ArrowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid size-11 place-items-center rounded-full ring-1 ring-inset ring-gold/30 text-ink",
        "transition-colors duration-300 hover:bg-white hover:text-gold",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}

function PlanCard({
  slide,
  index,
  onOpen,
}: {
  slide: Slide;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col overflow-hidden rounded-[20px] bg-white text-left ring-1 ring-inset ring-ink/5 transition-shadow duration-500 hover:shadow-[0_24px_50px_-20px_rgba(18,24,32,0.25)]"
    >
      <span className="relative block aspect-[1600/2263] w-full overflow-hidden bg-white">
        <Image
          src={slide.src}
          alt={`${slide.title} — ${slide.subtitle}`}
          fill
          // Two sheets are visible on first paint at desktop widths.
          loading={index < 3 ? "eager" : "lazy"}
          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 46vw, 380px"
          className="object-contain transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.03]"
        />
        <span className="glass-card absolute right-3 top-3 grid size-9 place-items-center rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <Maximize2 aria-hidden className="size-4 text-ink" strokeWidth={1.6} />
        </span>
      </span>

      <span className="flex flex-col gap-1 border-t border-ink/5 px-5 py-4">
        <span className="body-base text-ink">{slide.title}</span>
        <span className="body-xs text-ink-soft">{slide.subtitle}</span>
      </span>
    </button>
  );
}

function Lightbox({
  index,
  onClose,
  onStep,
}: {
  index: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const slide = planGallery.slides[index];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${slide.title} — full size`}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col bg-ink/92 p-4 backdrop-blur-sm sm:p-8"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 pb-4 text-white">
        <div className="min-w-0">
          <p className="truncate font-display text-xl leading-tight">
            {slide.title}
          </p>
          <p className="truncate text-xs text-white/60">{slide.subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LightboxButton
            label="Previous plan"
            onClick={(e) => {
              e.stopPropagation();
              onStep(-1);
            }}
            disabled={index === 0}
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden />
          </LightboxButton>
          <LightboxButton
            label="Next plan"
            onClick={(e) => {
              e.stopPropagation();
              onStep(1);
            }}
            disabled={index === planGallery.slides.length - 1}
          >
            <ChevronRight className="size-5" strokeWidth={1.75} aria-hidden />
          </LightboxButton>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-full ring-1 ring-inset ring-white/25 text-white transition-colors hover:bg-white hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      <div
        onClick={(event) => event.stopPropagation()}
        className="relative min-h-0 flex-1 overflow-auto rounded-[20px] bg-white"
      >
        <Image
          src={slide.src}
          alt={`${slide.title} — ${slide.subtitle}`}
          width={1600}
          height={2263}
          quality={90}
          className="mx-auto h-auto w-full max-w-[1100px]"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 pt-4">
        <p className="text-xs text-white/60">
          {index + 1} / {planGallery.slides.length}
        </p>
        <a
          href={planGallery.pdfHref}
          download
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-xs text-white/80 underline-offset-4 hover:text-white hover:underline"
        >
          {planGallery.pdfLabel}
          <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}

function LightboxButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: (event: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
