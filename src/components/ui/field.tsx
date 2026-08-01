import { cn } from "@/components/ui/cn";
import type { LabelHTMLAttributes, ReactNode } from "react";

/** Labeled form field wrapper: stacked label text over the control. */
export function Field({
  label,
  htmlFor,
  children,
  className,
  ...props
}: { label: ReactNode; children: ReactNode } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label htmlFor={htmlFor} className={cn("grid gap-[6px]", className)} {...props}>
      <span className="text-meta font-bold text-ink-2">{label}</span>
      {children}
    </label>
  );
}

/** Assertive inline error message (role=alert). */
export function FieldError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("m-0 rounded-md bg-[#fff0eb] px-[10px] py-[9px] text-meta text-[#963e2a]", className)}>
      {children}
    </p>
  );
}

/** Polite success message. */
export function FieldSuccess({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="status" className={cn("m-0 rounded-md bg-[#e7f8f1] px-[10px] py-[9px] text-meta text-[#1f7a4d]", className)}>
      {children}
    </p>
  );
}
