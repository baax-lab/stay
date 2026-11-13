import { cn } from "@/lib/cn";

/**
 * Wortmarke wie im Baax Hub: kleines Cyan-Quadrat, „Baax“ halbfett, „Stay“ normal.
 * `size` bleibt für bestehende Aufrufe und steuert nur die Schriftgröße.
 */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  const fontSize = Math.round(Math.max(17, Math.min(size * 0.6, 22)));
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-block size-2.5 rounded-[3px] bg-brand" aria-hidden />
      <span className="leading-none font-semibold tracking-tight text-ink" style={{ fontSize }}>
        Baax<span className="font-normal text-muted"> Stay</span>
      </span>
    </span>
  );
}
