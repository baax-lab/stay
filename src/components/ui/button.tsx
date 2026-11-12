import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong select-none";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-petrol hover:bg-brand-strong hover:text-white",
  secondary: "bg-surface text-petrol border border-line hover:border-brand hover:bg-brand-soft",
  ghost: "text-petrol hover:bg-brand-soft",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-6 text-base w-full",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  href,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
