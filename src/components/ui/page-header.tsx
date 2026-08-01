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
        "mb-[26px] flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow m-0 mb-[11px]">{eyebrow}</p> : null}
        <h1 className="m-0 font-display text-[clamp(40px,4.4vw,58px)] font-[520] leading-[1.02] tracking-[-0.055em] [&_em]:not-italic [&_em]:text-violet">
          {title}
        </h1>
        {lead ? <p className="m-0 mt-[10px] max-w-[640px] text-lead leading-[1.55] text-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
