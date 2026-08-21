import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 only serves quality values declared here. The large feature
    // photographs (About, Contact) are rendered full-bleed below the fold, so
    // they get a higher setting than the 75 default — bandwidth there doesn't
    // compete with LCP. The hero backdrop stays at 75 since it's the LCP image.
    qualities: [75, 85, 90],
  },
  // pdfkit reads its .afm font files from disk relative to its own module
  // directory — without this, bundling breaks that lookup at runtime.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
