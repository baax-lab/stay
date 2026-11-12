import "server-only";
import { prisma } from "@/lib/db";

/**
 * Anzeigenamen für Nutzer-IDs im Protokoll. Es gibt keine Nutzertabelle (Nutzer kommen aus dem Hub),
 * daher aus den Anmeldungen (LOGIN mit name/email im meta) gelesen.
 */
export async function auditUserNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const logins = await prisma.auditLog.findMany({
    where: { action: "LOGIN", userId: { in: unique } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, meta: true },
  });
  for (const l of logins) {
    if (!l.userId || map.has(l.userId)) continue;
    const m = (l.meta ?? {}) as { name?: string; email?: string };
    const label = m.name || m.email;
    if (label) map.set(l.userId, label);
  }
  return map;
}
