"use client";

import { Coins, LogOut, Menu, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { loggedInNav, loggedOutNav } from "@/components/nav-items";
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
      <button type="button" className="fx-mobile-menu-trigger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={20} />
      </button>
      {open && (
        <div className="fx-mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div ref={dialogRef} className="fx-mobile-menu-panel">
            <div className="fx-mobile-menu-head">
              <strong>FIGURE</strong>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button>
            </div>
            <Link href="/studio" className="fx-mobile-menu-create" onClick={() => setOpen(false)}><Plus size={17} />Create a figure</Link>
            <nav>
              {nav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} data-active={active} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                    <Icon size={18} />{item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="fx-mobile-menu-foot">
              {account ? (
                <>
                  <Link className="fx-mobile-menu-credits" href="/credits" onClick={() => setOpen(false)}><Coins size={16} /><span><strong>{account.credits}</strong> credits</span></Link>
                  <Link className="fx-mobile-menu-account" href="/account" onClick={() => setOpen(false)}>
                    <span>{account.name?.slice(0, 1).toUpperCase() || account.email?.slice(0, 1).toUpperCase() || "F"}</span>
                    <div><strong>{account.name || "Figure learner"}</strong><small>{account.email}</small></div>
                  </Link>
                  <button type="button" className="fx-mobile-menu-signout" onClick={() => { setOpen(false); void signOut({ redirectTo: "/" }); }}><LogOut size={15} />Sign out</button>
                </>
              ) : (
                <div className="fx-mobile-menu-auth">
                  <Sparkles size={18} /><p>Save figures, build collections, and track quiz mastery.</p>
                  <Link href="/signin" onClick={() => setOpen(false)}>Sign in</Link>
                </div>
              )}
            </div>
          </div>
          <button type="button" className="fx-mobile-menu-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
