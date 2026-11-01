import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nearly every page is personalized to the signed-in user, so we render on
  // request and skip Cache Components' static-shell model.
  cacheComponents: false,
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // Photos are resized in the browser first; this is a safety ceiling.
      bodySizeLimit: "8mb",
    },
  },
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
