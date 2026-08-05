import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { site } from "@/lib/content";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/LogoMark";
import { ThankYouOptionalForm } from "@/components/sections/ThankYouOptionalForm";

export const metadata: Metadata = {
  title: "Thank You",
  robots: { index: false, follow: true },
};

/**
 * Post-submission confirmation page. The contact form redirects here on a
 * successful lead instead of relying on an easy-to-miss inline message —
 * doubles as a stable URL for conversion tracking (GTM / Meta Ads).
 */
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string | string[] }>;
}) {
  const { leadId } = await searchParams;
  const resolvedLeadId = typeof leadId === "string" ? leadId : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-cream px-5 py-20 text-center text-ink">
      <Link href="/" aria-label={site.name} className="group flex items-center gap-2.5">
        <LogoMark className="size-9 transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:rotate-90" />
        <span className="font-display text-[21px] font-normal uppercase leading-[0.9] tracking-[-0.012em] text-ink">
          {site.name}
        </span>
      </Link>

      <span className="grid size-16 place-items-center rounded-full bg-gold/10 ring-1 ring-inset ring-gold/30">
        <CircleCheck aria-hidden className="size-8 text-gold" strokeWidth={1.4} />
      </span>

      <div className="flex max-w-130 flex-col gap-4">
        <p className="eyebrow flex items-center justify-center gap-3">
          <span aria-hidden className="h-px w-7 bg-gold" />
          Thank You
          <span aria-hidden className="h-px w-7 bg-gold" />
        </p>
        <h1 className="display-sm text-ink">Your enquiry is in.</h1>
        <p className="body-base text-ink">
          Thanks for reaching out to {site.name}. {site.contactPerson} and our team
          will get back to you shortly to help you take the next step with{" "}
          {site.project}.
        </p>
      </div>

      <ButtonLink href="/" variant="dark" icon="right">
        Back to Home
      </ButtonLink>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <a
          href={site.phoneHref}
          className="body-sm inline-flex items-center gap-2 font-normal text-ink transition-colors hover:text-gold"
        >
          <Icon name="phone" className="size-4 text-gold" />
          {site.phone}
        </a>
        <a
          href={site.whatsappHref}
          target="_blank"
          rel="noreferrer noopener"
          className="body-sm inline-flex items-center gap-2 font-normal text-ink transition-colors hover:text-gold"
        >
          <Icon name="whatsapp" className="size-4 text-gold" />
          WhatsApp us
        </a>
      </div>

      {resolvedLeadId ? <ThankYouOptionalForm leadId={resolvedLeadId} /> : null}
    </main>
  );
}
