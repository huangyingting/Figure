import { cn } from "@/components/ui/cn";
import type { ReactNode } from "react";

/**
 * Consistent page title block used across product pages: an uppercase eyebrow,
 * a large display heading, an optional lead paragraph, and optional actions
 * aligned to the end.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow m-0 mb-2">{eyebrow}</p> : null}
        <h1 className="m-0 font-display text-[clamp(30px,3vw,40px)] font-[560] leading-[1.08] tracking-[-0.015em] [&_em]:not-italic [&_em]:text-pine-dark">
          {title}
        </h1>
        {lead ? <p className="m-0 mt-[6px] max-w-[640px] text-body leading-[1.55] text-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
