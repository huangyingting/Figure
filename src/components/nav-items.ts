import { BookOpenCheck, Compass, FolderHeart, Heart, Play, Shapes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Single source of truth for primary navigation.
 *
 * Signed-in members navigate their own material; the Create action is a
 * dedicated header button, not a nav item. Signed-out visitors get a
 * deliberately short exploration path — the gallery and the live demo —
 * and exactly one auth entry (Sign in) in the header.
 */
export const loggedInNav: NavItem[] = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/library", label: "My figures", icon: Shapes },
  { href: "/collections", label: "Collections", icon: FolderHeart },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/quiz", label: "Quiz lab", icon: BookOpenCheck },
];

export const loggedOutNav: NavItem[] = [
  { href: "/discover", label: "Gallery", icon: Compass },
  { href: "/studio", label: "Live demo", icon: Play },
];
