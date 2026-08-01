"use client";

import { Coins, LogOut, Menu, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

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
        className="grid h-[38px] w-[38px] place-items-center rounded-lg border border-line-dark bg-white text-ink cursor-pointer"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            ref={dialogRef}
            className="flex w-[min(320px,86vw)] flex-col overflow-y-auto bg-[#f7f6f2] p-5 shadow-[-20px_0_60px_rgb(23_24_29_/_25%)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <strong className="font-display text-[18px] tracking-[0.02em]">FIGURE</strong>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-lg bg-transparent text-ink cursor-pointer"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <Button asChild size="md" className="min-h-[46px] rounded-[10px] px-[15px] text-meta font-bold">
              <Link href="/studio" onClick={() => setOpen(false)}><Plus size={17} />Create a figure</Link>
            </Button>
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
                    className="flex min-h-[48px] items-center gap-[11px] rounded-[9px] px-[13px] text-ui font-semibold text-ink no-underline data-[active=true]:bg-violet-pale data-[active=true]:text-violet-dark"
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
                    className="flex min-h-[44px] items-center gap-[9px] rounded-[10px] border border-line-dark px-[14px] text-meta text-ink no-underline"
                    href="/credits"
                    onClick={() => setOpen(false)}
                  >
                    <Coins size={16} /><span><strong>{account.credits}</strong> credits</span>
                  </Link>
                  <Link className="flex items-center gap-[11px] text-inherit no-underline" href="/account" onClick={() => setOpen(false)}>
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-violet font-bold text-white">{account.name?.slice(0, 1).toUpperCase() || account.email?.slice(0, 1).toUpperCase() || "F"}</span>
                    <div><strong className="block text-meta">{account.name || "Figure learner"}</strong><small className="text-[10px] text-muted">{account.email}</small></div>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full rounded-[10px] text-meta font-bold"
                    onClick={() => { setOpen(false); void signOut({ redirectTo: "/" }); }}
                  >
                    <LogOut size={15} />Sign out
                  </Button>
                </>
              ) : (
                <div className="grid gap-[10px] rounded-xl border border-line bg-white p-4">
                  <Sparkles size={18} /><p className="m-0 text-[11px] leading-[1.5] text-muted">Save figures, build collections, and track quiz mastery.</p>
                  <Button asChild size="md" className="min-h-[40px] w-fit rounded-[9px] px-[15px] text-meta font-bold">
                    <Link href="/signin" onClick={() => setOpen(false)}>Sign in</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="order-[-1] flex-1 border-0 bg-[rgb(23_24_29_/_45%)] backdrop-blur-[2px] cursor-pointer"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
