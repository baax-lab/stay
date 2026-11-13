import type { Metadata, Viewport } from "next";
// Inter wie im Baax Hub, selbst gehostet (keine Anfragen an Google)
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Baax Stay", template: "%s · Baax Stay" },
  description: "Suchmakler für touristisch genutzte Immobilien – internes Arbeitswerkzeug der Baax Immobilien GmbH",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Baax Stay", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0cc0df",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* Hausfarbe aus BRAND_COLOR, zur Laufzeit ausgeliefert */}
        {/* eslint-disable-next-line @next/next/no-css-tags -- bewusst: Laufzeit-CSS, nicht Teil des Builds */}
        <link rel="stylesheet" href="/brand.css" precedence="default" />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
