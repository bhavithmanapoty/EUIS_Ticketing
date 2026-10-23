import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user (auth cookies) and must be dynamic, so the
  // cacheComponents / partialPrefetching defaults only add complexity here.
  cacheComponents: false,
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
