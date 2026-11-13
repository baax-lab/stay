import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import { Logo } from "@/components/layout/logo";
import { BottomNav, SideNav, type NavItem } from "@/components/layout/nav";
import { Icons } from "@/components/layout/icons";
import { getActiveEvent } from "@/lib/settings";
import { PendingBadge } from "@/components/leads/pending-badge";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";

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
    <div className="flex min-h-dvh md:gap-3 md:p-3 print:block print:p-0">
      <ServiceWorkerRegister />
      <aside className="glass sticky top-3 hidden h-[calc(100dvh-24px)] w-[236px] shrink-0 flex-col rounded-2xl px-3 py-4 md:flex print:hidden">
        <Link href="/" className="mb-5 px-2.5 pt-1">
          <Logo />
        </Link>
        <form action="/suche" method="get" role="search" className="mb-5">
          <input
            type="search"
            name="q"
            aria-label="Überall suchen"
            placeholder="Suchen …"
            className="h-9 w-full rounded-md border border-line-strong/60 bg-surface-solid/80 px-3 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          />
        </form>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <SideNav items={items} />
        </div>
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {event.active && (
            <div className="rounded-lg bg-brand-soft px-2.5 py-2 text-[12px] text-brand-strong">
              <div className="font-semibold">Aktives Event</div>
              <div>{event.sourceDetail || event.source}</div>
            </div>
          )}
          <PendingBadge />
          <div className="flex items-center gap-2.5 px-1">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand-strong" aria-hidden>
              {(user.name || user.email || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{user.name || user.email}</div>
              <div className="truncate text-[11px] text-ink-3">{ROLE_LABEL[user.role]}</div>
            </div>
            {/* Formular statt Link: Links werden in Produktion vorab geladen und würden sonst abmelden */}
            <form action="/auth/logout" method="post">
              <button type="submit" className="rounded-md px-1.5 py-1 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink" title="Abmelden">
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col md:min-h-0">
        <header className="glass sticky top-0 z-20 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-2.5 md:hidden print:hidden">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <PendingBadge />
            <form action="/auth/logout" method="post">
              <button type="submit" className="text-[13px] text-muted" aria-label={`Abmelden (${user.name || "Konto"})`} title="Abmelden">
                Abmelden
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 pt-6 pb-28 md:px-9 md:py-7 print:p-0">
          <div className="mx-auto max-w-6xl print:max-w-none">{children}</div>
        </main>
        <BottomNav items={mobileItems} />
      </div>
    </div>
  );
}
