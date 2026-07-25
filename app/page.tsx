import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { About } from "@/components/sections/About";
import { Amenities } from "@/components/sections/Amenities";
import { Contact } from "@/components/sections/Contact";
import { Faq } from "@/components/sections/Faq";
import { Hero } from "@/components/sections/Hero";
import { Location } from "@/components/sections/Location";
import { Testimonials } from "@/components/sections/Testimonials";
import { UnitPlans } from "@/components/sections/UnitPlans";
import { WhyChoose } from "@/components/sections/WhyChoose";
import { faq, site } from "@/lib/content";

/**
 * Structured data — helps search engines surface the development as a
 * local commercial real-estate listing and renders the FAQ as a rich result.
 */
const address = {
  "@type": "PostalAddress",
  streetAddress: "D-123, MIDC Industrial Area, near SIES Pharmaceutical College",
  addressLocality: "Nerul MIDC, Navi Mumbai",
  addressRegion: "Maharashtra",
  postalCode: "400706",
  addressCountry: "IN",
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: site.name,
    description: site.description,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    image: `${site.url}/images/hero-building.png`,
    priceRange: "₹₹₹",
    areaServed: { "@type": "City", name: site.city },
    address,
  },
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.name} — ${site.project}`,
    description:
      "Pure commercial office and showroom units in Nerul MIDC, Navi Mumbai.",
    image: `${site.url}/images/hero-building.png`,
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: 6000000,
      highPrice: 15000000,
      availability: "https://schema.org/PreOrder",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, author-controlled content.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar />

      <main className="flex-1">
        <Hero />
        <About />
        <WhyChoose />
        <Amenities />
        <UnitPlans />
        <Testimonials />
        <Location />
        <Faq />
        <Contact />
      </main>

      <Footer />
    </>
  );
}
