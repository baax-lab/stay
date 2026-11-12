import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baax Stay",
    short_name: "Baax Stay",
    description: "Lead-Erfassung und Suchaufträge – Baax Immobilien GmbH",
    start_url: "/leads/neu",
    display: "standalone",
    background_color: "#f4f8f9",
    theme_color: "#19b5d4",
    lang: "de",
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
