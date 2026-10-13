import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rein clientseitige App: alle Daten liegen in IndexedDB im Browser.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
