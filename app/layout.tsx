import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Playfair_Display } from "next/font/google";

import { site } from "@/lib/content";
import "./globals.css";

/* Display serif — hero and section headings */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* Secondary serif — footer column headings */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/* UI sans — body copy, labels, form controls */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Commercial Offices & Showrooms in Nerul MIDC, Navi Mumbai`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: [
    "commercial property Navi Mumbai",
    "office space Nerul MIDC",
    "showroom for sale Navi Mumbai",
    "commercial shops Nerul",
    "Codename Magnitude",
    "Reliable Realties",
    "commercial real estate investment Navi Mumbai",
  ],
  applicationName: site.name,
  authors: [{ name: site.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.project}`,
    description: site.description,
    images: [
      {
        url: "/images/hero-building.png",
        width: 1448,
        height: 1086,
        alt: `${site.project} commercial development in Nerul MIDC, Navi Mumbai`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.project}`,
    description: site.description,
    images: ["/images/hero-building.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ed",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        {children}
      </body>
    </html>
  );
}
