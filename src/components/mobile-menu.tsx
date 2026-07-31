"use client";

import { BookOpenCheck, Coins, Compass, FolderHeart, LogOut, Menu, Plus, Shapes, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/library", label: "My figures", icon: Shapes },
  { href: "/collections", label: "Collections", icon: FolderHeart },
  { href: "/quiz", label: "Quiz lab", icon: BookOpenCheck },
];

interface MobileMenuAccount {
  name: string | null;
  email: string | null;
  credits: number;
}

export function MobileMenu({ account, onSignOut }: { account: MobileMenuAccount | null; onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="fx-mobile-menu-trigger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={20} />
      </button>
      {open && (
        <div className="fx-mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="fx-mobile-menu-panel">
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
                  <div className="fx-mobile-menu-account">
                    <span>{account.name?.slice(0, 1).toUpperCase() || account.email?.slice(0, 1).toUpperCase() || "F"}</span>
                    <div><strong>{account.name || "Figure learner"}</strong><small>{account.email}</small></div>
                  </div>
                  <form action={onSignOut}>
                    <button type="submit" className="fx-mobile-menu-signout"><LogOut size={15} />Sign out</button>
                  </form>
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
