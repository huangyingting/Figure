import { cn } from "@/components/ui/cn";
import type { ReactNode } from "react";

/** Horizontal rule with optional centered label (e.g. "or use email"). */
export function Divider({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) {
    return <hr className={cn("border-0 border-t border-line", className)} />;
  }
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-micro uppercase text-muted-2",
        "before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line",
        className,
      )}
    >
      <span>{children}</span>
    </div>
  );
}
