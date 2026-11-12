import { cn } from "@/lib/cn";

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight text-petrol", className)}>
      <span
        className="grid place-items-center rounded-xl bg-brand text-petrol"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        aria-hidden
      >
        b
      </span>
      <span>
        Baax <span className="font-normal text-muted">Stay</span>
      </span>
    </span>
  );
}
