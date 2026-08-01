import { cn } from "@/components/ui/cn";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "pine" | "muted" | "green" | "amber";

const tones: Record<Tone, string> = {
  pine: "bg-pine-pale text-pine-dark",
  muted: "border border-line-dark bg-paper text-muted",
  green: "bg-[#e7f8f1] text-green",
  amber: "bg-[#fff4e0] text-amber",
};

/** Small pill label. */
export function Badge({
  tone = "pine",
  className,
  children,
  ...props
}: { tone?: Tone; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] rounded-full px-[11px] py-[6px] text-micro font-bold",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
