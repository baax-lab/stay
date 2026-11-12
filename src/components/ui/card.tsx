import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,58,71,0.04)]", className)}>{children}</section>;
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-petrol">{children}</h2>
      {action}
    </header>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-petrol">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "danger" | "brand"; children: React.ReactNode }) {
  const map = {
    neutral: "bg-canvas text-ink border-line",
    ok: "bg-ok-soft text-ok border-ok/30",
    warn: "bg-warn-soft text-warn border-warn/30",
    danger: "bg-danger-soft text-danger border-danger/30",
    brand: "bg-brand-soft text-petrol border-brand/40",
  } as const;
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", map[tone])}>{children}</div>;
}
