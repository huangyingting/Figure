import Link from "next/link";

import { auth } from "@/auth";
import { AppHeader, type HeaderUser } from "@/components/app-header";

export async function headerUser(): Promise<HeaderUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { name: session.user.name, email: session.user.email, credits: session.user.credits };
}

export function FigureBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`fx-brand${compact ? " compact" : ""}`} href="/">
      <span className="fx-brand-mark"><i /><i /><i /></span>
      <span><strong>FIGURE</strong>{!compact && <small>Learn what you can see.</small>}</span>
    </Link>
  );
}

export async function ProductShell({ children }: { children: React.ReactNode; active?: string }) {
  const user = await headerUser();
  return (
    <div className="fx-app">
      <AppHeader user={user} />
      <div className="fx-main">{children}</div>
    </div>
  );
}
