"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

export function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));
}

/** Seitenleiste wie im Baax Hub: nur Text, aktiver Punkt weiß hinterlegt. */
export function SideNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav aria-label="Hauptnavigation">
      <ul className="flex flex-col gap-px">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-lg px-2.5 py-2 text-[15px] transition-colors",
                  active ? "bg-surface-solid font-medium text-ink shadow-sm" : "text-muted hover:bg-white/50 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Untere Navigation am Handy: mit Symbolen, damit man sie auf der Messe mit dem Daumen trifft. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav aria-label="Hauptnavigation" className="glass safe-bottom fixed inset-x-0 bottom-0 z-30 flex rounded-none border-x-0 border-b-0 pt-1 md:hidden print:hidden">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-1 flex-col items-center gap-1 py-1.5 text-xs font-medium", active ? "text-brand-strong" : "text-muted")}
          >
            <span className="h-5 w-5 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
