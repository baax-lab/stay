import { notFound, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ROLE_LABEL, entries } from "@/lib/labels";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

export const metadata = { title: "Entwickler-Login" };

async function devLogin(formData: FormData) {
  "use server";
  if (!env.devLoginEnabled) throw new Error("Entwickler-Login deaktiviert");
  const role = String(formData.get("role") ?? "MITARBEITER") as Role;
  const name = String(formData.get("name") ?? "Dev").trim() || "Dev";
  const next = String(formData.get("next") ?? "/");
  const user = {
    id: `dev-${role.toLowerCase()}`,
    name,
    email: `${role.toLowerCase()}@dev.local`,
    role,
  };
  await createSession(user);
  await audit({ userId: user.id, action: "LOGIN", entity: "Session", meta: { via: "dev", role, name: user.name, email: user.email } });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export default async function DevLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!env.devLoginEnabled) notFound();
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo className="mb-8" size={40} />
      <h1 className="text-2xl font-semibold text-petrol">Entwickler-Login</h1>
      <div className="mt-4">
        <Notice tone="warn">Nur für lokale Entwicklung. In Produktion ist diese Seite nicht erreichbar.</Notice>
      </div>
      <form action={devLogin} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <Field label="Name">
          <Input name="name" defaultValue="Max Mustermann" />
        </Field>
        <Field label="Rolle">
          <Select name="role" defaultValue="MITARBEITER">
            {entries(ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" size="lg">
          Anmelden
        </Button>
      </form>
    </main>
  );
}
