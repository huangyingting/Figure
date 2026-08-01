import { cn } from "@/components/ui/cn";
import type { HTMLAttributes } from "react";

/** Standard surface: white card with border, rounded corners, soft shadow. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-white shadow-card",
        className,
      )}
      {...props}
    />
  );
}
