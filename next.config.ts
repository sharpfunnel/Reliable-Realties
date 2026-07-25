import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 only serves quality values declared here. The hero and the large
    // feature photographs are rendered full-bleed, so they get a higher setting
    // than the 75 default.
    qualities: [75, 85, 90],
  },
};

export default nextConfig;
