import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { AUDIT_PAGE_SIZE, auditQuery, auditWhere, parseAuditFilter } from "@/lib/audit-filter";
import { auditUserNames } from "@/lib/services/audit-view";
import { Card, PageHeader } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata = { title: "Protokoll" };

type SP = Record<string, string | string[] | undefined>;

/** Links zu den Datensätzen, soweit es eine Detailseite gibt. */
function entityHref(entity: string, id: string | null): string | null {
  if (!id) return null;
  const map: Record<string, string> = { Lead: "/leads/", Mandate: "/auftraege/", Property: "/objekte/", Partner: "/partner/", Referrer: "/tippgeber/" };
  return map[entity] ? map[entity] + id : null;
}

function metaText(meta: unknown): string {
  if (!meta || typeof meta !== "object" || Object.keys(meta as object).length === 0) return "";
  const s = JSON.stringify(meta);
  return s.length > 220 ? s.slice(0, 220) + " …" : s;
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  if (!can.viewAuditLog(user.role)) redirect("/einstellungen");
  const sp = await searchParams;
  const filter = parseAuditFilter(sp);
  const where = auditWhere(filter);

  const [total, rows, actions, entities] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filter.page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  const names = await auditUserNames(rows.map((r) => r.userId));
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const str = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";

  return (
    <div>
      <PageHeader
        title="Protokoll"
        subtitle={`${total.toLocaleString("de-DE")} Einträge: Anmeldungen, Änderungen, Exporte, Versand, Portal- und Partnerzugriffe`}
        action={
          <ButtonLink href={`/einstellungen/protokoll/export${auditQuery(sp, { page: undefined })}`} variant="secondary" size="sm">
            CSV-Export
          </ButtonLink>
        }
      />

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] lg:items-end">
          <Field label="Aktion">
            <Select name="action" defaultValue={filter.action ?? ""}>
              <option value="">alle</option>
              {actions.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.action}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bereich">
            <Select name="entity" defaultValue={filter.entity ?? ""}>
              <option value="">alle</option>
              {entities.map((e) => (
                <option key={e.entity} value={e.entity}>
                  {e.entity}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Datensatz-ID">
            <Input name="entityId" defaultValue={str("entityId")} />
          </Field>
          <Field label="Nutzer-ID">
            <Input name="userId" defaultValue={str("userId")} />
          </Field>
          <Field label="von">
            <Input name="from" type="date" defaultValue={str("from")} />
          </Field>
          <Field label="bis">
            <Input name="to" type="date" defaultValue={str("to")} />
          </Field>
          <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
            <Button type="submit" size="sm">
              Filtern
            </Button>
            <ButtonLink href="/einstellungen/protokoll" variant="ghost" size="sm">
              Zurücksetzen
            </ButtonLink>
          </div>
        </form>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>Zeitpunkt</Th>
            <Th>Nutzer</Th>
            <Th>Aktion</Th>
            <Th>Datensatz</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = entityHref(r.entity, r.entityId);
            return (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs">{r.createdAt.toLocaleString("de-DE")}</Td>
                <Td className="text-xs">
                  {r.userId ? (
                    <Link href={`/einstellungen/protokoll${auditQuery({}, { userId: r.userId })}`} className="hover:text-petrol hover:underline">
                      {names.get(r.userId) ?? r.userId}
                    </Link>
                  ) : (
                    <span className="text-muted">System / öffentlich</span>
                  )}
                  {r.ip && <div className="text-muted">{r.ip}</div>}
                </Td>
                <Td className="text-xs font-medium">{r.action}</Td>
                <Td className="text-xs">
                  {r.entity}
                  {r.entityId && (
                    <div className="font-mono text-[11px] text-muted">
                      {href ? (
                        <Link href={href} className="underline">
                          {r.entityId}
                        </Link>
                      ) : (
                        r.entityId
                      )}
                    </div>
                  )}
                </Td>
                <Td className="max-w-md break-all font-mono text-[11px] text-muted">{metaText(r.meta)}</Td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <Td className="text-muted">Keine Einträge für diesen Filter.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Seiten">
          {filter.page > 1 ? (
            <Link href={`/einstellungen/protokoll${auditQuery(sp, { page: filter.page - 1 })}`} className="underline">
              ← neuer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Seite {filter.page} von {pages}
          </span>
          {filter.page < pages ? (
            <Link href={`/einstellungen/protokoll${auditQuery(sp, { page: filter.page + 1 })}`} className="underline">
              älter →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
