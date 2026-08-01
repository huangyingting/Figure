import { BookOpenCheck, Compass, FolderHeart, Heart, Shapes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Single source of truth for primary navigation. The desktop header appends a
 * "Studio" link; the mobile menu omits it in favor of a dedicated create CTA,
 * so both surfaces derive from these bases instead of maintaining parallel
 * arrays that can silently drift.
 */
export const loggedInNav: NavItem[] = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/library", label: "My figures", icon: Shapes },
  { href: "/collections", label: "Collections", icon: FolderHeart },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/quiz", label: "Quiz lab", icon: BookOpenCheck },
];

export const loggedOutNav: NavItem[] = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/quiz", label: "Quiz lab", icon: BookOpenCheck },
];
