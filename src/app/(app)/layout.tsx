import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import { Logo } from "@/components/layout/logo";
import { BottomNav, SideNav, type NavItem } from "@/components/layout/nav";
import { Icons } from "@/components/layout/icons";
import { getActiveEvent } from "@/lib/settings";
import { PendingBadge } from "@/components/leads/pending-badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const event = await getActiveEvent();

  const items: NavItem[] = [
    { href: "/", label: "Start", icon: Icons.home, exact: true },
    { href: "/leads/neu", label: "Erfassen", icon: Icons.plus },
    { href: "/leads", label: "Leads", icon: Icons.list, exact: true },
    { href: "/auftraege", label: "Aufträge", icon: Icons.briefcase },
    { href: "/objekte", label: "Objekte", icon: Icons.building },
    { href: "/besichtigungen", label: "Besichtigungen", icon: Icons.camera },
    { href: "/partner", label: "Partner", icon: Icons.handshake },
    { href: "/tippgeber", label: "Tippgeber", icon: Icons.gift },
    { href: "/wissen", label: "Wissen", icon: Icons.globe },
    { href: "/suche", label: "Suche", icon: Icons.search },
  ];
  if (can.viewAnalytics(user.role)) items.push({ href: "/auswertung", label: "Auswertung", icon: Icons.chart });
  if (can.editEventSetting(user.role)) {
    items.push({ href: "/einstellungen", label: "Einstellungen", icon: Icons.settings });
  }
  const mobileItems = items.filter((i) => ["/", "/leads/neu", "/leads", "/auftraege", "/objekte"].includes(i.href));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-line bg-surface p-4 md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <Link href="/" className="mb-6 px-2 pt-1">
          <Logo />
        </Link>
        <SideNav items={items} />
        <div className="mt-auto space-y-3 px-2 text-sm">
          {event.active && (
            <div className="rounded-xl bg-brand-soft px-3 py-2 text-xs text-petrol">
              <div className="font-semibold">Aktives Event</div>
              <div>{event.sourceDetail || event.source}</div>
            </div>
          )}
          <div>
            <div className="truncate font-medium text-petrol">{user.name || user.email}</div>
            <div className="text-xs text-muted">{ROLE_LABEL[user.role]}</div>
          </div>
          <Link href="/auth/logout" className="text-xs text-muted hover:text-petrol">
            Abmelden
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/">
            <Logo size={28} />
          </Link>
          <div className="flex items-center gap-3">
            <PendingBadge />
            <Link href="/auth/logout" className="text-xs text-muted" aria-label="Abmelden">
              {user.name?.split(" ")[0] || "Konto"}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
        <BottomNav items={mobileItems} />
      </div>
    </div>
  );
}
