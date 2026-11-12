import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Getrennter Build-Ordner für Dev/E2E, damit Produktions-Build und Dev-Server sich nicht in die Quere kommen
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
