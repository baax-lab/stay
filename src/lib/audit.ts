import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LEAD_CREATE"
  | "LEAD_UPDATE"
  | "LEAD_MERGE"
  | "LEAD_EXPORT"
  | "LEAD_PUBLIC_CREATE"
  | "HUB_SYNC"
  | "SETTING_UPDATE";

export async function audit(input: {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        meta: input.meta ?? {},
        ip: input.ip ?? null,
      },
    });
  } catch (e) {
    // Protokollierung darf den Vorgang nicht abbrechen, aber auch nicht still verschwinden.
    console.error("AuditLog fehlgeschlagen", e);
  }
}
