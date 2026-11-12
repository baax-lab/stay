"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker (nur Produktion) und lädt die Erfassungsseite vorab,
 * damit /leads/neu auf der Messe auch ohne Netz startet.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.active?.postMessage("warm"))
      .catch(() => undefined);
  }, []);
  return null;
}
