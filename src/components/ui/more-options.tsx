import { cn } from "@/lib/cn";

/** Seltene Angaben zum Aufklappen („Mehr Angaben“) wie im Hub. Pflichtfelder gehören nie hier hinein. */
export function MoreOptions({
  label = "Mehr Angaben",
  hint,
  defaultOpen = false,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cn("group rounded-xl border border-line-strong/50 bg-surface-solid/60", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink select-none [&::-webkit-details-marker]:hidden">
        <span>
          {label}
          {hint ? <span className="ml-2 font-normal text-muted">{hint}</span> : null}
        </span>
        <span className="text-muted transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="space-y-4 border-t border-line px-4 pt-4 pb-4">{children}</div>
    </details>
  );
}
