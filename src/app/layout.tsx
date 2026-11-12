import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Baax Stay", template: "%s · Baax Stay" },
  description: "Suchmakler für touristisch genutzte Immobilien – internes Arbeitswerkzeug der Baax Immobilien GmbH",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
  appleWebApp: { capable: true, title: "Baax Stay", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#19b5d4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
