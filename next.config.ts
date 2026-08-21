import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 only serves quality values declared here. Everything above the
    // fold (hero, about) stays at the 75 default to keep bytes down where
    // they compete with LCP/TBT; the Contact photo is lower down and gets a
    // slightly higher setting since it's clear of the critical path.
    qualities: [75, 85],
  },
  // pdfkit reads its .afm font files from disk relative to its own module
  // directory — without this, bundling breaks that lookup at runtime.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
