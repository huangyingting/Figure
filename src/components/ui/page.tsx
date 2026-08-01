import { cn } from "@/components/ui/cn";
import type { HTMLAttributes } from "react";

/** Centered page content frame with standard vertical padding. */
export function Page({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={cn("frame min-h-[60vh] pt-10 pb-16", className)} {...props} />;
}
