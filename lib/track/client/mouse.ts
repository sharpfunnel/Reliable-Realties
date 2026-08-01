"use client";

import { track } from "@/lib/track/client/queue";

const RAGE_WINDOW_MS = 1000;
const RAGE_THRESHOLD = 3;
const DEAD_CLICK_WINDOW_MS = 600;
const HOVER_SAMPLE_INTERVAL_MS = 1500;

const INTERACTIVE_SELECTOR =
  'a,button,input,select,textarea,label,[role="button"],[role="link"],[data-cta-id],[onclick]';

function cssSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  return classes ? `${el.tagName.toLowerCase()}.${classes}` : el.tagName.toLowerCase();
}

function pagePct(clientX: number, clientY: number) {
  const doc = document.documentElement;
  const pageX = clientX + window.scrollX;
  const pageY = clientY + window.scrollY;
  return {
    xPct: (pageX / doc.scrollWidth) * 100,
    yPct: (pageY / doc.scrollHeight) * 100,
  };
}

export function initMouseTracking() {
  const recentClicks = new Map<Element, number[]>();
  const rageCooldown = new WeakSet<Element>();
  let lastHoverSample = 0;

  function onClick(e: MouseEvent) {
    const target = e.target as Element | null;
    if (!target) return;

    const path = window.location.pathname;
    const { xPct, yPct } = pagePct(e.clientX, e.clientY);
    track.heatmap({ path, type: "click", xPct, yPct, viewportWidth: window.innerWidth });

    // Rage click: 3+ clicks on the same element within RAGE_WINDOW_MS.
    const now = Date.now();
    const timestamps = (recentClicks.get(target) ?? []).filter((t) => now - t < RAGE_WINDOW_MS);
    timestamps.push(now);
    recentClicks.set(target, timestamps);

    if (timestamps.length >= RAGE_THRESHOLD && !rageCooldown.has(target)) {
      rageCooldown.add(target);
      setTimeout(() => rageCooldown.delete(target), RAGE_WINDOW_MS);
      track.mouse({
        path,
        type: "rage_click",
        x: e.clientX,
        y: e.clientY,
        targetSelector: cssSelector(target),
      });
    }

    // Dead click: click on a non-interactive element with no resulting DOM mutation.
    const isInteractive = target.closest(INTERACTIVE_SELECTOR) !== null;
    if (!isInteractive) {
      const startPath = window.location.pathname;
      let mutated = false;
      const observer = new MutationObserver(() => {
        mutated = true;
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(() => {
        observer.disconnect();
        if (!mutated && window.location.pathname === startPath) {
          track.mouse({
            path,
            type: "dead_click",
            x: e.clientX,
            y: e.clientY,
            targetSelector: cssSelector(target),
          });
        }
      }, DEAD_CLICK_WINDOW_MS);
    }
  }

  function onDblClick(e: MouseEvent) {
    const target = e.target as Element | null;
    track.mouse({
      path: window.location.pathname,
      type: "double_click",
      x: e.clientX,
      y: e.clientY,
      targetSelector: target ? cssSelector(target) : undefined,
    });
  }

  function onMouseMove(e: MouseEvent) {
    const now = Date.now();
    if (now - lastHoverSample < HOVER_SAMPLE_INTERVAL_MS) return;
    lastHoverSample = now;
    const { xPct, yPct } = pagePct(e.clientX, e.clientY);
    track.heatmap({
      path: window.location.pathname,
      type: "hover",
      xPct,
      yPct,
      viewportWidth: window.innerWidth,
    });
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("dblclick", onDblClick, true);
  document.addEventListener("mousemove", onMouseMove, { passive: true });

  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("dblclick", onDblClick, true);
    document.removeEventListener("mousemove", onMouseMove);
  };
}
