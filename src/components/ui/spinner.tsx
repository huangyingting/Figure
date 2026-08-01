import { LoaderCircle } from "lucide-react";

import { cn } from "@/components/ui/cn";

/** Spinning loader icon; inherits color via currentColor. */
export function Spinner({ size = 17, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={cn("spin", className)} aria-hidden="true" />;
}
