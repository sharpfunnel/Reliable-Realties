"use client";

import { track } from "@/lib/track/client/queue";

const observed = new WeakSet<HTMLFormElement>();
const viewed = new WeakSet<HTMLFormElement>();
const started = new WeakSet<HTMLFormElement>();
const submitted = new WeakSet<HTMLFormElement>();

export function initFormTracking() {
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const form = entry.target as HTMLFormElement;
        if (entry.isIntersecting && !viewed.has(form)) {
          viewed.add(form);
          const formId = form.getAttribute("data-form-id");
          if (formId) track.form({ formId, action: "viewed" });
        }
      }
    },
    { threshold: 0.3 },
  );

  function fieldName(field: EventTarget | null): string | undefined {
    if (field instanceof HTMLElement && "name" in field) {
      return (field as HTMLInputElement).name || field.id || undefined;
    }
    return undefined;
  }

  function attach(form: HTMLFormElement) {
    if (observed.has(form)) return;
    observed.add(form);
    const formId = form.getAttribute("data-form-id");
    if (!formId) return;

    intersectionObserver.observe(form);

    form.addEventListener("focusin", (e) => {
      if (!started.has(form)) {
        started.add(form);
        track.form({ formId, action: "started" });
      }
      track.form({ formId, action: "field_focus", fieldName: fieldName(e.target) });
    });

    form.addEventListener(
      "focusout",
      (e) => {
        const target = e.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
          if (target.value && target.value.trim().length > 0) {
            track.form({ formId, action: "field_complete", fieldName: fieldName(target) });
          }
        }
      },
      true,
    );

    form.addEventListener(
      "invalid",
      (e) => {
        const target = e.target;
        const message =
          target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
            ? target.validationMessage
            : undefined;
        track.form({ formId, action: "validation_error", fieldName: fieldName(target), errorMessage: message });
      },
      true,
    );

    form.addEventListener("submit", () => {
      submitted.add(form);
      track.form({ formId, action: "submitted" });
    });
  }

  document.querySelectorAll<HTMLFormElement>("form[data-form-id]").forEach(attach);

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLFormElement && node.hasAttribute("data-form-id")) attach(node);
        if (node instanceof Element) {
          node.querySelectorAll<HTMLFormElement>("form[data-form-id]").forEach(attach);
        }
      });
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  function onPageHide() {
    document.querySelectorAll<HTMLFormElement>("form[data-form-id]").forEach((form) => {
      if (started.has(form) && !submitted.has(form)) {
        const formId = form.getAttribute("data-form-id");
        if (formId) track.form({ formId, action: "abandoned" });
      }
    });
  }
  window.addEventListener("pagehide", onPageHide);

  return () => {
    intersectionObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener("pagehide", onPageHide);
  };
}
