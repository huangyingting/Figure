"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { MobileMenu } from "@/components/mobile-menu";

export interface HeaderUser {
  name?: string | null;
  email?: string | null;
  credits: number;
}

const loggedOutNav = [
  { href: "/discover", label: "Discover" },
  { href: "/quiz", label: "Quiz lab" },
  { href: "/studio", label: "Studio" },
];

const loggedInNav = [
  { href: "/discover", label: "Discover" },
  { href: "/library", label: "My figures" },
  { href: "/collections", label: "Collections" },
  { href: "/favorites", label: "Favorites" },
  { href: "/quiz", label: "Quiz lab" },
  { href: "/studio", label: "Studio" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader({ user = null, extra }: { user?: HeaderUser | null; extra?: React.ReactNode }) {
  const pathname = usePathname();
  const nav = user ? loggedInNav : loggedOutNav;

  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <Link className="brand" href="/" aria-label="Figure home">
          <span className="brand-symbol" aria-hidden="true"><i /><i /></span>
          <strong>FIGURE</strong>
        </Link>

        <nav className="app-nav" aria-label="Primary">
          {nav.map((item) => (
            <Link key={item.href} className="header-link" href={item.href} data-active={isActive(pathname, item.href)} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="app-actions">
          {extra}
          {user ? (
            <>
              <Link className="studio-credit-link" href="/credits"><strong>{user.credits}</strong> credits</Link>
              <Link className="studio-account-chip" href="/account" aria-label="Account settings" data-active={isActive(pathname, "/account")}>
                <span>{user.name?.slice(0, 1).toUpperCase() || user.email?.slice(0, 1).toUpperCase() || "F"}</span>
              </Link>
              <button type="button" className="studio-signout" aria-label="Sign out" onClick={() => void signOut({ redirectTo: "/" })}><LogOut size={15} /></button>
            </>
          ) : (
            <>
              <span className="guest-badge" title="You are browsing as a guest. Sign in to create, save, and edit."><span className="guest-dot" />Guest · read-only</span>
              <Link className="studio-signin-link" href={`/signin?callbackUrl=${encodeURIComponent(pathname)}`}>Sign in</Link>
            </>
          )}
        </div>

        <div className="app-mobile">
          {!user && <span className="guest-badge guest-badge-compact" title="You are browsing as a guest."><span className="guest-dot" />Guest</span>}
          <MobileMenu
            account={user ? { name: user.name ?? null, email: user.email ?? null, credits: user.credits } : null}
          />
        </div>
      </div>
    </header>
  );
}
