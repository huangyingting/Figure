import { cn } from "@/components/ui/cn";
import type { ReactNode } from "react";

/**
 * Unified empty-state block: a soft icon chip, heading, supporting copy, and an
 * optional call to action. Replaces the divergent per-page empty states.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  large = false,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  large?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center content-center gap-2 rounded-2xl border border-dashed border-line-dark bg-paper/45 p-9 text-center",
        large ? "min-h-[430px]" : "min-h-[260px]",
        className,
      )}
    >
      {icon ? (
        <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-pine-pale text-[22px] text-pine">
          {icon}
        </span>
      ) : null}
      <h2 className="mt-[9px] mb-0 font-display text-[26px] tracking-[-0.015em]">{title}</h2>
      {description ? <p className="m-0 text-ui text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
