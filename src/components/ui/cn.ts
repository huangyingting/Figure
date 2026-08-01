import clsx, { type ClassValue } from "clsx";

/** Merge conditional class names. Later values win via normal CSS ordering. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
