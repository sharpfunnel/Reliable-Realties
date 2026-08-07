"use client";

import { useActionState } from "react";

import { login, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = {};

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <span className="font-display text-2xl font-medium text-ink">
            Magnitude
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-ink-muted">
            Admin dashboard
          </span>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="h-11 w-full rounded-lg border border-ink/15 bg-white px-3.5 text-sm text-ink outline-none transition-colors focus:border-gold"
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 h-11 w-full rounded-lg bg-gold text-sm font-semibold text-white transition-colors hover:bg-gold/90 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
