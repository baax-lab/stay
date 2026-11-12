"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

export function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));
}

export function SideNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(item) ? "bg-brand text-petrol" : "text-ink hover:bg-brand-soft",
          )}
        >
          <span className="h-5 w-5 shrink-0 [&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-surface/95 px-2 pt-2 backdrop-blur md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium",
            isActive(item) ? "text-brand-strong" : "text-muted",
          )}
        >
          <span className="h-6 w-6 [&>svg]:h-6 [&>svg]:w-6">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
