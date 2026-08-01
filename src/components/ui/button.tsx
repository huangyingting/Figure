import { Slot } from "@/components/ui/slot";
import { cn } from "@/components/ui/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "danger" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-bold whitespace-nowrap transition-[background,border-color,transform,box-shadow,opacity] duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-violet",
  accent: "bg-acid text-ink hover:brightness-95",
  outline: "border border-line-dark bg-white text-ink hover:bg-[#f2f1ed]",
  ghost: "bg-transparent text-ink-2 hover:bg-violet-pale hover:text-violet-dark",
  danger:
    "border border-[rgba(220,38,38,0.28)] bg-white text-[#dc2626] hover:bg-[rgba(220,38,38,0.07)] hover:border-[rgba(220,38,38,0.5)]",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[38px] px-[13px] text-meta",
  md: "min-h-[44px] px-4 text-meta",
  lg: "min-h-[50px] px-[18px] text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render as the child element (e.g. a Next.js Link) while keeping button styling. */
  asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(base, variants[variant], sizes[size], className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
