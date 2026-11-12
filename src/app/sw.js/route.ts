import { serviceWorkerSource } from "@/lib/sw-script";

/** Service Worker mit eingesetzter Version (APP_VERSION), Header siehe next.config.ts. */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(serviceWorkerSource(process.env.APP_VERSION || "dev"), {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", "service-worker-allowed": "/" },
  });
}
