import { BookOpenCheck, Coins, Compass, FolderHeart, LogOut, Plus, Shapes, Sparkles } from "lucide-react";
import Link from "next/link";

import { auth, signOut } from "@/auth";
import { MobileMenu } from "@/components/mobile-menu";

const nav = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/library", label: "My figures", icon: Shapes },
  { href: "/collections", label: "Collections", icon: FolderHeart },
  { href: "/quiz", label: "Quiz lab", icon: BookOpenCheck },
];

export function FigureBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`fx-brand${compact ? " compact" : ""}`} href="/">
      <span className="fx-brand-mark"><i /><i /><i /></span>
      <span><strong>FIGURE</strong>{!compact && <small>Learn what you can see.</small>}</span>
    </Link>
  );
}

export async function ProductShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const session = await auth();
  return (
    <div className="fx-app-shell">
      <aside className="fx-sidebar">
        <FigureBrand />
        <Link href="/studio" className="fx-create-button"><Plus size={17} />Create a figure</Link>
        <nav>
          <p>Workspace</p>
          {nav.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} data-active={active === item.href} aria-current={active === item.href ? "page" : undefined}><Icon size={18} />{item.label}</Link>;
          })}
        </nav>
        <div className="fx-sidebar-foot">
          {session?.user ? (
            <>
              <Link className="fx-credit-pill" href="/credits" data-active={active === "/credits"} aria-current={active === "/credits" ? "page" : undefined}><Coins size={16} /><span><strong>{session.user.credits}</strong> credits</span></Link>
              <div className="fx-account-chip">
                <span>{session.user.name?.slice(0, 1).toUpperCase() || session.user.email?.slice(0, 1).toUpperCase() || "F"}</span>
                <div><strong>{session.user.name || "Figure learner"}</strong><small>{session.user.email}</small></div>
                <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                  <button type="submit" aria-label="Sign out"><LogOut size={15} /></button>
                </form>
              </div>
            </>
          ) : (
            <div className="fx-sidebar-auth">
              <Sparkles size={18} /><p>Save figures, build collections, and track quiz mastery.</p>
              <Link href="/signin">Sign in</Link>
            </div>
          )}
        </div>
      </aside>
      <div className="fx-main">
        <header className="fx-mobile-header">
          <FigureBrand compact />
          <div className="fx-mobile-header-actions">
            <Link href="/studio"><Plus size={17} />Create</Link>
            <MobileMenu
              account={session?.user ? { name: session.user.name ?? null, email: session.user.email ?? null, credits: session.user.credits } : null}
              onSignOut={async () => { "use server"; await signOut({ redirectTo: "/" }); }}
            />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
