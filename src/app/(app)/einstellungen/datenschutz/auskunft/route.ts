import { NextResponse, type NextRequest } from "next/server";
import { clientIp, getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { parsePrivacyQuery } from "@/lib/privacy";
import { buildExport, findSubjects, subjectCount } from "@/lib/services/privacy";

/**
 * DSGVO-Auskunft als JSON-Datei. Nur POST (Suchbegriff im Formular, nicht in der URL), nur Admin.
 * Das Session-Cookie ist SameSite=Lax, ein fremdes Formular kann diese Route also nicht mit Anmeldung aufrufen.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!can.handlePrivacyRequests(user.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const fd = await req.formData();
  const q = parsePrivacyQuery(String(fd.get("q") ?? ""));
  if (!q) return NextResponse.json({ error: "Suchbegriff fehlt" }, { status: 400 });
  const subjects = await findSubjects(q);
  const data = await buildExport(subjects);

  await audit({
    userId: user.id,
    action: "PRIVACY_EXPORT",
    entity: "Privacy",
    meta: { count: subjectCount(subjects), ids: [...subjects.leads, ...subjects.mandates, ...subjects.referrers, ...subjects.partners].map((s) => s.id) },
    ip: await clientIp(),
  });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="dsgvo-auskunft-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
