"use client";

import { track } from "@/lib/track/client/queue";

const viewedAt = new WeakMap<Element, number>();
const hovered = new WeakSet<Element>();
const observed = new WeakSet<Element>();

export function initCtaTracking() {
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !viewedAt.has(entry.target)) {
          const ctaId = entry.target.getAttribute("data-cta-id");
          if (!ctaId) continue;
          viewedAt.set(entry.target, Date.now());
          track.cta({ ctaId, action: "viewed" });
        }
      }
    },
    { threshold: 0.5 },
  );

  function onHover(e: Event) {
    const target = e.currentTarget as Element;
    const ctaId = target.getAttribute("data-cta-id");
    if (!ctaId || hovered.has(target)) return;
    hovered.add(target);
    track.cta({ ctaId, action: "hovered" });
  }

  function onClick(e: Event) {
    const target = e.currentTarget as Element;
    const ctaId = target.getAttribute("data-cta-id");
    if (!ctaId) return;
    const firstViewed = viewedAt.get(target);
    track.cta({
      ctaId,
      action: "clicked",
      timeBeforeClick: firstViewed ? Date.now() - firstViewed : undefined,
    });
  }

  function attach(el: Element) {
    if (observed.has(el)) return;
    observed.add(el);
    intersectionObserver.observe(el);
    el.addEventListener("mouseenter", onHover);
    el.addEventListener("click", onClick);
  }

  function scan(root: ParentNode) {
    root.querySelectorAll("[data-cta-id]").forEach(attach);
  }

  scan(document);

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          if (node.hasAttribute("data-cta-id")) attach(node);
          scan(node);
        }
      });
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  return () => {
    intersectionObserver.disconnect();
    mutationObserver.disconnect();
  };
}
