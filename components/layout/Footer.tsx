import Link from "next/link";

import { footer, navLinks, site } from "@/lib/content";
import { Icon, SocialIcon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Reveal } from "@/components/ui/Reveal";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="px-5 py-15 lg:px-10">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid gap-12 lg:grid-cols-[522px_minmax(0,1fr)_309px] lg:gap-[74px]">
          {/* Brand */}
          <Reveal className="flex flex-col gap-5">
            <Logo size="lg" />
            <p className="body-sm max-w-[330px] font-normal text-ink">
              {site.description}
            </p>
            <ul className="flex items-center gap-3">
              {footer.socials.map((social) => (
                <li key={social.name}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.name}
                    className="grid size-9 place-items-center rounded-full text-ink ring-1 ring-inset ring-ink/15 transition-colors duration-300 hover:bg-gold hover:text-white hover:ring-gold"
                  >
                    <SocialIcon name={social.name} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Explore */}
          <Reveal delay={90} className="flex flex-col gap-5">
            <FooterHeading>Explore</FooterHeading>
            <ul className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-ink transition-colors duration-300 hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Contact */}
          <Reveal delay={180} className="flex flex-col gap-5">
            <FooterHeading>Contact</FooterHeading>
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <Icon name="phone" className="size-4 shrink-0 text-gold" />
                <a
                  href={site.phoneHref}
                  className="text-[13px] text-ink transition-colors hover:text-gold"
                >
                  Call us now
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="mail" className="size-4 shrink-0 text-gold" />
                <a
                  href={`mailto:${site.email}`}
                  className="text-[13px] text-ink transition-colors hover:text-gold"
                >
                  {site.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="whatsapp" className="mt-0.5 size-4 shrink-0 text-gold" />
                <a
                  href={site.whatsappHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[13px] text-ink transition-colors hover:text-gold"
                >
                  WhatsApp us
                </a>
              </li>
            </ul>
          </Reveal>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-ink/10 pt-6 text-xs text-forest sm:flex-row sm:justify-between">
          <p>
            © {YEAR} {site.name}. All rights reserved.
          </p>
          <ul className="flex items-center">
            {footer.legal.map((item, index) => (
              <li key={item.href} className="flex items-center">
                {index > 0 ? (
                  <span aria-hidden className="mx-4 h-3 w-px bg-ink/20" />
                ) : null}
                <Link
                  href={item.href}
                  className="text-ink transition-colors duration-300 hover:text-gold"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-ink">Crafted by {site.credit}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-serif-alt text-2xl font-medium leading-[1.15] tracking-[-0.03em] text-forest">
        {children}
      </h2>
      <span aria-hidden className="h-px w-10 bg-ink/15" />
    </div>
  );
}
