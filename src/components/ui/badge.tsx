import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-line",
  brand: "bg-brand-soft text-petrol border-brand/40",
  ok: "bg-ok-soft text-ok border-ok/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  danger: "bg-danger-soft text-danger border-danger/30",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}
