/**
 * Service Worker für die Messe (Konzept §7.4): /leads/neu startet auch ohne Netz,
 * gespeichert wird dann über den Offline-Puffer (IndexedDB) und später nachgesendet.
 *
 * Regeln:
 * - /leads/neu: Netz zuerst, sonst die zuletzt geladene Fassung aus dem Cache
 * - andere Seiten ohne Netz: kurze Offline-Seite mit Link zur Erfassung
 * - /_next/static: Cache zuerst (Dateinamen enthalten einen Hash)
 * - nie gecacht: API, Dateien, Anmeldung, Portal, Partnerzugang, alles außer GET
 * - Anmeldeseite erreicht (abgemeldet): gecachte Seiten werden gelöscht
 *
 * Als Funktion, damit die Version (APP_VERSION) beim Ausliefern eingesetzt wird und alte Caches beim Update verschwinden.
 */
export function serviceWorkerSource(version: string): string {
  const v = JSON.stringify(version);
  return `"use strict";
const VERSION = ${v};
const PAGES = "stay-pages-" + VERSION;
const STATIC = "stay-static-" + VERSION;
const OFFLINE_PAGE = "/leads/neu";
const NEVER = ["/api/", "/auth/", "/portal/", "/partner-zugang/", "/dossier/", "/bericht/", "/vorlage/", "/sw.js"];
const STATIC_LIMIT = 400;
// kleine, ungehashte Dateien: Netz zuerst, ohne Netz aus dem Cache
const SHELL = ["/brand.css", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(warm().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("stay-") && k !== PAGES && k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "warm") event.waitUntil(warm().catch(() => undefined));
  if (event.data === "clear") event.waitUntil(caches.delete(PAGES));
});

/** Erfassungsseite samt aller Skripte und Styles vorab laden (nur angemeldet, sonst kommt eine Weiterleitung). */
async function warm() {
  const res = await fetch(OFFLINE_PAGE, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok || res.redirected) return;
  const html = await res.clone().text();
  const pages = await caches.open(PAGES);
  await pages.put(OFFLINE_PAGE, res);
  // Pfade enthalten Klammern, z. B. chunks/app/(app)/leads/neu/page-….js; nur an Anführungszeichen, Leerraum, Backslash und Tags trennen
  // Chunks stehen im HTML absolut (/_next/static/…) und in den RSC-Daten relativ (static/chunks/…)
  const found = (html.match(/static\\/(?:chunks|css|media)\\/[^"'\\s\\\\<>]+/g) || []).map((p) => "/_next/" + p);
  const assets = Array.from(new Set(found.concat(SHELL)));
  const stat = await caches.open(STATIC);
  await Promise.all(
    assets.map(async (url) => {
      if (await stat.match(url)) return;
      try {
        const r = await fetch(url);
        if (r.ok) await stat.put(url, r);
      } catch (e) {}
    }),
  );
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - STATIC_LIMIT; i++) await cache.delete(keys[i]);
}

function offlineResponse() {
  const body = '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Baax Stay</title>' +
    '<body style="font-family:system-ui,sans-serif;color:#0f1a20;background:#f3f6f8;padding:32px;max-width:480px;margin:auto">' +
    '<h1 style="font-size:22px">Keine Verbindung</h1><p>Diese Seite braucht Netz. Kontakte erfassen geht weiter: sie werden auf dem Gerät gespeichert und automatisch übertragen, sobald wieder Netz da ist.</p>' +
    '<p><a href="/leads/neu" style="display:inline-block;background:#0cc0df;color:#062a33;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Kontakt erfassen</a></p></body></html>';
  return new Response(body, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((p) => url.pathname.startsWith(p))) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      }),
    );
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok) await (await caches.open(STATIC)).put(url.pathname, res.clone());
          return res;
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: STATIC })) || Response.error()),
    );
    return;
  }

  if (req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        const finalPath = new URL(res.url || req.url).pathname;
        if (finalPath.startsWith("/auth/")) {
          // abgemeldet: nichts Persönliches im Cache lassen
          await caches.delete(PAGES);
        } else if (url.pathname === OFFLINE_PAGE && res.ok && !res.redirected) {
          const cache = await caches.open(PAGES);
          await cache.put(OFFLINE_PAGE, res.clone());
        }
        return res;
      } catch (e) {
        const cached = await caches.match(OFFLINE_PAGE, { cacheName: PAGES });
        if (url.pathname === OFFLINE_PAGE && cached) return cached;
        return offlineResponse();
      }
    })(),
  );
});
`;
}
