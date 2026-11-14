import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // never bundle or trace the local data folder (orders database, token, raw captures)
  outputFileTracingExcludes: { "*": [".data/**"] },
  serverExternalPackages: ["better-sqlite3"],
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
