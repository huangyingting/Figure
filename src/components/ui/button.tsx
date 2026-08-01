import { Slot } from "@/components/ui/slot";
import { cn } from "@/components/ui/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "danger" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-[background,border-color,color,transform,box-shadow,opacity] duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-pine text-white hover:bg-pine-dark",
  accent: "bg-marigold text-ink hover:brightness-95",
  outline: "border border-line-dark bg-paper text-ink hover:border-ink",
  ghost: "bg-transparent text-ink-2 hover:bg-pine-pale hover:text-pine-dark",
  danger:
    "border border-[rgba(212,80,44,0.35)] bg-paper text-coral hover:bg-[rgba(212,80,44,0.08)] hover:border-[rgba(212,80,44,0.55)]",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[40px] px-4 text-meta",
  md: "min-h-[48px] px-5 text-ui",
  lg: "min-h-[54px] px-6 text-body",
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
