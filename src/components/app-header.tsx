"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { MobileMenu } from "@/components/mobile-menu";
import { loggedInNav, loggedOutNav } from "@/components/nav-items";

export interface HeaderUser {
  name?: string | null;
  email?: string | null;
  credits: number;
}

const studioLink = { href: "/studio", label: "Studio" };
const headerLoggedOutNav = [...loggedOutNav, studioLink];
const headerLoggedInNav = [...loggedInNav, studioLink];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader({ user = null, extra }: { user?: HeaderUser | null; extra?: React.ReactNode }) {
  const pathname = usePathname();
  const nav = user ? headerLoggedInNav : headerLoggedOutNav;

  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(23_24_29/11%)] bg-[rgb(250_249_246/90%)] backdrop-blur-lg">
      <div className="frame flex min-h-[66px] items-center gap-[26px]">
        <Link className="flex items-center gap-[11px] text-ink no-underline" href="/" aria-label="Figure home">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <strong className="font-display text-base tracking-[0.2em]">FIGURE</strong>
        </Link>

        <nav className="hidden items-center gap-[22px] md:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link key={item.href} className="nav-link" href={item.href} data-active={isActive(pathname, item.href)} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-[14px] md:flex">
          {extra}
          {user ? (
            <>
              <Link className="rounded-md bg-violet-pale px-3 py-2 text-meta font-bold text-violet-dark no-underline" href="/credits"><strong className="font-display text-[15px]">{user.credits}</strong> credits</Link>
              <Link className="grid h-8 w-8 place-items-center rounded-[9px] bg-violet text-[12px] font-extrabold text-white no-underline hover:bg-violet-dark" href="/account" aria-label="Account settings" data-active={isActive(pathname, "/account")}>
                <span>{user.name?.slice(0, 1).toUpperCase() || user.email?.slice(0, 1).toUpperCase() || "F"}</span>
              </Link>
              <button type="button" className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border border-line bg-white text-muted transition-colors hover:bg-[#fff0eb] hover:text-coral" aria-label="Sign out" onClick={() => void signOut({ redirectTo: "/" })}><LogOut size={15} /></button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-line-dark bg-white px-[11px] py-[6px] text-[10px] font-bold text-muted" title="You are browsing as a guest. Sign in to create, save, and edit."><span className="h-[7px] w-[7px] rounded-full bg-amber shadow-[0_0_0_3px_rgb(235_168_57/18%)]" />Guest · read-only</span>
              <Link className="rounded-md bg-violet-pale px-3 py-2 text-meta font-bold text-violet-dark no-underline" href={`/signin?callbackUrl=${encodeURIComponent(pathname)}`}>Sign in</Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-[10px] md:hidden">
          {!user && <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-line-dark bg-white px-[9px] py-[5px] text-[9px] font-bold text-muted" title="You are browsing as a guest."><span className="h-[7px] w-[7px] rounded-full bg-amber shadow-[0_0_0_3px_rgb(235_168_57/18%)]" />Guest</span>}
          <MobileMenu
            account={user ? { name: user.name ?? null, email: user.email ?? null, credits: user.credits } : null}
          />
        </div>
      </div>
    </header>
  );
}
