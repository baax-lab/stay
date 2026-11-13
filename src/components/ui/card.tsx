import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("glass rounded-2xl p-5", className)}>{children}</section>;
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-petrol">{children}</h2>
      {action}
    </header>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] leading-[1.2] font-semibold text-ink md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[14px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "danger" | "brand"; children: React.ReactNode }) {
  const map = {
    neutral: "bg-surface-2 text-ink border-line",
    ok: "bg-ok-soft text-ok border-ok/30",
    warn: "bg-warn-soft text-warn border-warn/30",
    danger: "bg-danger-soft text-danger border-danger/30",
    brand: "bg-brand-soft text-brand-strong border-brand/30",
  } as const;
  return <div role={tone === "danger" ? "alert" : undefined} className={cn("rounded-md border px-4 py-3 text-sm", map[tone])}>{children}</div>;
}
