"use client";

import { useState, type FormEvent } from "react";

import { contact } from "@/lib/content";

type Status = "idle" | "submitting" | "success" | "error";

const fieldClass =
  "h-10 w-full rounded-[10px] border border-ink/15 bg-white/60 px-3.5 text-sm text-ink outline-none transition-colors duration-300 focus:border-gold";

/**
 * Optional follow-up shown on the thank-you page — the main contact form
 * only asks for name + phone, so this lets a visitor add email, budget and
 * a message to the lead they just created, if they want to.
 */
export function ThankYouOptionalForm({ leadId }: { leadId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = data.get("email");
    const budget = data.get("budget");
    const message = data.get("message");

    if (!email && !budget && !message) {
      setError("Add at least one detail to save.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, email, budget, message }),
      });

      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="body-sm max-w-100 text-center text-gold">
        Thanks — we&apos;ve added those details to your enquiry.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-100 flex-col gap-4 rounded-[20px] bg-white/60 p-6 text-left shadow-[var(--shadow-card)] sm:p-7.5"
    >
      <div>
        <p className="body-sm font-medium text-ink">Add a few more details</p>
        <p className="body-xs mt-1 text-ink/70">
          Optional — helps us tailor what we send you.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Email Address</span>
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          autoComplete="email"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">{contact.form.budgetLabel}</span>
        <select name="budget" defaultValue="" className={fieldClass}>
          <option value="" disabled>
            {contact.form.budgetLabel}
          </option>
          {contact.form.budgets.map((budget) => (
            <option key={budget} value={budget}>
              {budget}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Your message</span>
        <textarea
          name="message"
          rows={3}
          placeholder="Describe your ideas, needs, or questions..."
          className="w-full resize-none rounded-[10px] border border-ink/15 bg-white/60 p-3.5 text-sm text-ink outline-none transition-colors duration-300 focus:border-gold"
        />
      </label>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="h-10 w-full rounded-[10px] bg-ink text-sm font-semibold text-white transition-colors duration-300 hover:bg-ink/90 disabled:opacity-70"
      >
        {status === "submitting" ? "Saving…" : "Save Details"}
      </button>

      {error ? <p className="body-xs text-red-600">{error}</p> : null}
    </form>
  );
}
