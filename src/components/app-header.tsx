"use client";

import { ChevronDown, Coins, LogOut, Plus, UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { MobileMenu } from "@/components/mobile-menu";
import { loggedInNav, loggedOutNav } from "@/components/nav-items";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export interface HeaderUser {
  name?: string | null;
  email?: string | null;
  credits: number;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AccountMenu({ user }: { user: HeaderUser }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = user.name?.slice(0, 1).toUpperCase() || user.email?.slice(0, 1).toUpperCase() || "F";
  const itemClass =
    "flex w-full cursor-pointer items-center gap-[9px] rounded-[8px] px-[10px] py-[9px] text-ui font-semibold text-ink-2 no-underline hover:bg-pine-pale hover:text-pine-dark";

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 rounded-full border border-transparent bg-transparent p-[3px] pr-[6px] transition-colors hover:border-line data-[open=true]:border-line data-[open=true]:bg-paper"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("Account menu")}
        data-open={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-pine font-display text-[15px] font-bold text-white">{initial}</span>
        <ChevronDown size={14} className={`text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("Account")}
          className="absolute right-0 top-[calc(100%+9px)] z-[70] w-[236px] rounded-2xl border border-line bg-paper p-[6px] shadow-[0_20px_55px_rgb(60_52_30/18%)]"
        >
          <div className="border-b border-line px-[10px] pb-[10px] pt-[6px]">
            <strong className="block truncate text-ui">{user.name || t("Figure learner")}</strong>
            <small className="block truncate text-micro text-muted">{user.email}</small>
          </div>
          <div className="grid gap-[2px] pt-[6px]">
            <Link role="menuitem" className={itemClass} href="/account" onClick={() => setOpen(false)}>
              <UserCog size={15} />{t("Account settings")}
            </Link>
            <Link role="menuitem" className={itemClass} href="/credits" onClick={() => setOpen(false)}>
              <Coins size={15} /><span className="mr-auto">{t("Credits")}</span>
              <strong className="font-display text-[15px] text-pine-dark">{user.credits}</strong>
            </Link>
            <button
              role="menuitem"
              type="button"
              className={`${itemClass} border-0 bg-transparent text-left hover:bg-[#fdeee7] hover:text-coral`}
              onClick={() => void signOut({ redirectTo: "/" })}
            >
              <LogOut size={15} />{t("Sign out")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppHeader({ user = null, extra }: { user?: HeaderUser | null; extra?: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const nav = user ? loggedInNav : loggedOutNav;

  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(60_52_30/12%)] bg-[rgb(246_241_228/92%)] backdrop-blur-lg">
      <div className="frame flex min-h-[72px] items-center gap-[30px]">
        <Link className="wordmark text-[27px] no-underline" href="/" aria-label={t("Figure home")}>
          figure
        </Link>

        <nav className="hidden items-center gap-[24px] md:flex" aria-label={t("Primary")}>
          {nav.map((item) => (
            <Link key={item.href} className="nav-link" href={item.href} data-active={isActive(pathname, item.href)} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {extra}
          <LanguageSwitcher compact />
          {user ? (
            <>
              <Link
                className="whitespace-nowrap rounded-full bg-pine-pale px-4 py-[9px] text-meta font-bold text-pine-dark no-underline transition-colors hover:bg-[#d3e6d9]"
                href="/credits"
              >
                <strong className="font-display text-[16px]">{user.credits}</strong> {t("credits")}
              </Link>
              <Button asChild size="sm">
                <Link href="/studio"><Plus size={16} />{t("Create")}</Link>
              </Button>
              <AccountMenu user={user} />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href={`/signin?callbackUrl=${encodeURIComponent(pathname)}`}>{t("Sign in")}</Link>
            </Button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-[10px] md:hidden">
          <MobileMenu
            account={user ? { name: user.name ?? null, email: user.email ?? null, credits: user.credits } : null}
          />
        </div>
      </div>
    </header>
  );
}
