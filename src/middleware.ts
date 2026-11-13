import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Alle Seiten außer den öffentlichen erfordern Hub-Login (Konzept §11).
 * Die eigentliche Rechteprüfung passiert zusätzlich serverseitig in jeder Action.
 */
const PUBLIC_PREFIXES = ["/api/hub/status", "/brand.css", "/interesse", "/auth/", "/api/public/", "/api/cron/", "/api/health", "/portal/", "/partner-zugang/", "/datenschutz"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Druck-Token (PDF-Rendering): die Seite bzw. der Route Handler prüft das Token selbst
  if (req.nextUrl.searchParams.has("pt") && (pathname.startsWith("/dossier/") || pathname.startsWith("/bericht/") || pathname.startsWith("/vorlage/") || pathname.startsWith("/api/files/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET ?? "";
  const user = token && secret.length >= 32 ? await verifySession(token, secret) : null;

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", pathname + req.nextUrl.search);
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("x-user-role", user.role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt).*)"],
};
