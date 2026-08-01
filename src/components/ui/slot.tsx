import { Children, cloneElement, isValidElement } from "react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";

import { cn } from "@/components/ui/cn";

interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

/**
 * Minimal Radix-style Slot: merges its props (notably className) onto its single
 * child element instead of rendering a wrapper. Lets components expose an
 * `asChild` escape hatch so a styled Button can render as a Next.js <Link>.
 */
export function Slot({ children, className, ...props }: SlotProps) {
  if (!isValidElement(children)) return null;
  const child = children as ReactElement<Record<string, unknown>>;
  const childClass = child.props.className as string | undefined;
  return cloneElement(child, {
    ...props,
    ...child.props,
    className: cn(className, childClass),
  });
}

/** Guard for callers that must pass exactly one element to Slot. */
export function onlyChild(children: ReactNode): ReactElement {
  return Children.only(children as ReactElement);
}
