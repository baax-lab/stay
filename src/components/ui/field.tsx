import * as React from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-canvas";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  group = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  /** true für Chip-Gruppen und Tag-Eingaben: dann kein <label>, sonst würde das erste Element den ganzen Text als Namen erhalten. */
  group?: boolean;
}) {
  const Wrapper: React.ElementType = group ? "div" : "label";
  return (
    <Wrapper className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-petrol">
        <span>
          {label}
          {required && (
            <span className="text-danger" aria-hidden>
              {" "}
              *
            </span>
          )}
        </span>
        {hint && (
          <span className="text-xs font-normal text-muted" aria-hidden>
            {hint}
          </span>
        )}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-sm text-danger" role="alert">
          {error}
        </span>
      )}
    </Wrapper>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(control, "appearance-none bg-no-repeat pr-10", className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235d6f76' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")", backgroundPosition: "right 0.9rem center" }} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3", className)}>
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-strong" {...props} />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

/** Große Auswahl-Chips (z. B. Rolle, Budget) – gut auf dem Handy bedienbar. */
export function ChipGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  multiple = false,
}: {
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T | T[] | null;
  onChange: (v: T) => void;
  multiple?: boolean;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <div className="flex flex-wrap gap-2" role={multiple ? "group" : "radiogroup"} aria-label={name}>
      {options.map((o) => {
        const active = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "border-brand bg-brand text-petrol" : "border-line bg-surface text-ink hover:border-brand",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
