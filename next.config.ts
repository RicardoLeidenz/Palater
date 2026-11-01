import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nearly every page is personalized to the signed-in user, so we render on
  // request and skip Cache Components' static-shell model.
  cacheComponents: false,
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Location for "near me"; camera for the photo picker. Nothing else.
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()" },
        ],
      },
    ];
  },
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
