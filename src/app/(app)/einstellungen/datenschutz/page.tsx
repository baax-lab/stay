import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/card";
import { PrivacyTool } from "./privacy-tool";

export const metadata = { title: "Datenschutz-Anfragen" };

export default async function PrivacyRequestsPage() {
  const user = await requireUser();
  if (!can.handlePrivacyRequests(user.role)) redirect("/einstellungen");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Datenschutz-Anfragen"
        subtitle="Auskunft und Löschung je Person. GwG-Unterlagen bleiben 5 Jahre nach Ende der Geschäftsbeziehung, Belege zu Prämien 10 Jahre."
      />
      <PrivacyTool />
    </div>
  );
}
