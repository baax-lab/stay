import { env } from "@/lib/env";
import { brandCss } from "@/lib/brand";

/** Hausfarbe aus BRAND_COLOR zur Laufzeit (ohne neuen Build änderbar). Leer = Standardfarben aus globals.css. */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(brandCss(env.brandColor), {
    headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
