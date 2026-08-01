"use client";

import { Coins, LogOut, Menu, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { loggedInNav, loggedOutNav } from "@/components/nav-items";
import { Button } from "@/components/ui";
import { useModalDialog } from "@/components/use-modal-dialog";

interface MobileMenuAccount {
  name: string | null;
  email: string | null;
  credits: number;
}

export function MobileMenu({ account }: { account: MobileMenuAccount | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const nav = account ? loggedInNav : loggedOutNav;
  const dialogRef = useModalDialog<HTMLDivElement>(open, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        className="grid h-[40px] w-[40px] cursor-pointer place-items-center rounded-full border border-line-dark bg-paper text-ink"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>
      {/* Portaled to <body>: the sticky header's backdrop-filter otherwise becomes
          the containing block for this fixed overlay and clips it to header height. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            ref={dialogRef}
            className="flex w-[min(320px,86vw)] flex-col overflow-y-auto bg-shell p-5 shadow-[-20px_0_60px_rgb(35_33_27_/_25%)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="wordmark text-[24px]">figure</span>
              <button
                type="button"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-transparent text-ink"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            {account && (
              <Button asChild size="md">
                <Link href="/studio" onClick={() => setOpen(false)}><Plus size={17} />Create a figure</Link>
              </Button>
            )}
            <nav className="mt-[18px] grid gap-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[50px] items-center gap-[11px] rounded-xl px-[13px] text-body font-semibold text-ink no-underline data-[active=true]:bg-pine-pale data-[active=true]:text-pine-dark"
                  >
                    <Icon size={18} />{item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto grid gap-3 pt-5">
              {account ? (
                <>
                  <Link
                    className="flex min-h-[46px] items-center gap-[9px] rounded-full border border-line-dark px-[16px] text-meta text-ink no-underline"
                    href="/credits"
                    onClick={() => setOpen(false)}
                  >
                    <Coins size={16} /><span><strong>{account.credits}</strong> credits</span>
                  </Link>
                  <Link className="flex items-center gap-[11px] text-inherit no-underline" href="/account" onClick={() => setOpen(false)}>
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-pine font-display text-[16px] font-bold text-white">{account.name?.slice(0, 1).toUpperCase() || account.email?.slice(0, 1).toUpperCase() || "F"}</span>
                    <div><strong className="block text-meta">{account.name || "Figure learner"}</strong><small className="text-micro text-muted">{account.email}</small></div>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => { setOpen(false); void signOut({ redirectTo: "/" }); }}
                  >
                    <LogOut size={15} />Sign out
                  </Button>
                </>
              ) : (
                <div className="grid gap-3 rounded-2xl border border-line bg-paper p-4">
                  <Sparkles size={18} className="text-pine" />
                  <p className="m-0 text-meta leading-[1.55] text-muted">Sign in to create figures, build collections, and track mastery. New accounts start with 12 free credits.</p>
                  <Button asChild size="md">
                    <Link href="/signin" onClick={() => setOpen(false)}>Sign in</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="order-[-1] flex-1 cursor-pointer border-0 bg-[rgb(35_33_27_/_45%)] backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
