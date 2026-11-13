import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

/**
 * Abmelden nur per POST: GET-Links werden vom Browser bzw. Next.js vorab geladen und dürfen nichts verändern.
 *
 * Antwort ist eine kleine Seite statt einer Weiterleitung:
 * - leert die vom Service Worker gecachten Seiten und die Formular-Entwürfe (nicht den Offline-Puffer mit noch nicht gesendeten Kontakten)
 * - leitet relativ weiter, damit es unter jedem Hostnamen funktioniert (CSP form-action 'self' prüft auch Weiterleitungen)
 */
export async function POST() {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit({ userId: user.id, action: "LOGOUT", entity: "Session" });
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abgemeldet · Baax Stay</title><meta http-equiv="refresh" content="3;url=/auth/login"></head>
<body style="font-family:system-ui,sans-serif;color:#0f1a20;background:#f3f6f8;padding:32px">Abgemeldet. <a href="/auth/login">Weiter zur Anmeldung</a>
<script>
(async function () {
  try {
    if (self.caches) for (const k of await caches.keys()) if (k.indexOf("stay-pages-") === 0) await caches.delete(k);
    // Formular-Entwürfe (können Kundendaten enthalten) vom Gerät löschen
    for (const k of Object.keys(localStorage)) if (k.indexOf("stay-draft:") === 0) localStorage.removeItem(k);
  } catch (e) {}
  location.replace("/auth/login");
})();
</script></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET() {
  return new NextResponse(null, { status: 303, headers: { location: "/" } });
}
