import { cn } from "@/lib/cn";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-surface", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 align-top last:border-b-0", className)}>{children}</td>;
}
