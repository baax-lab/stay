/** Filter für die Protokoll-Ansicht und den CSV-Export (rein, getestet). */

export type AuditFilter = {
  action?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  from?: Date;
  /** exklusiv: Beginn des Folgetags von „bis“ */
  to?: Date;
  page: number;
};

export const AUDIT_PAGE_SIZE = 100;

const ID = /^[A-Za-z0-9_:.@-]{1,120}$/;
const WORD = /^[A-Z_]{2,40}$/;
const ENTITY = /^[A-Za-z]{2,40}$/;

function day(v: string | undefined, plusOne = false): Date | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  if (plusOne) d.setDate(d.getDate() + 1);
  return d;
}

export function parseAuditFilter(sp: Record<string, string | string[] | undefined>): AuditFilter {
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const action = get("action");
  const entity = get("entity");
  const entityId = get("entityId");
  const userId = get("userId");
  const page = Math.max(1, Math.min(10_000, Number.parseInt(get("page") ?? "1", 10) || 1));
  return {
    action: action && WORD.test(action) ? action : undefined,
    entity: entity && ENTITY.test(entity) ? entity : undefined,
    entityId: entityId && ID.test(entityId) ? entityId : undefined,
    userId: userId && ID.test(userId) ? userId : undefined,
    from: day(get("from")),
    to: day(get("to"), true),
    page,
  };
}

/** Prisma-Where als einfaches Objekt (ohne Prisma-Import, damit testbar). */
export function auditWhere(f: AuditFilter) {
  return {
    ...(f.action ? { action: f.action } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.entityId ? { entityId: f.entityId } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
  };
}

/** Filter wieder als Query-String (für Seitenwechsel und Export-Link). */
export function auditQuery(sp: Record<string, string | string[] | undefined>, override: Record<string, string | number | undefined> = {}): string {
  const out = new URLSearchParams();
  for (const k of ["action", "entity", "entityId", "userId", "from", "to", "page"]) {
    const v = k in override ? override[k] : Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k];
    if (v !== undefined && v !== "") out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}
