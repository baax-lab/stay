import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { DEFAULT_BRAND, parseHex } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baax Stay",
    short_name: "Baax Stay",
    description: "Lead-Erfassung und Suchaufträge – Baax Immobilien GmbH",
    start_url: "/leads/neu",
    display: "standalone",
    background_color: "#f4f8f9",
    theme_color: parseHex(env.brandColor) ?? DEFAULT_BRAND,
    lang: "de",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
