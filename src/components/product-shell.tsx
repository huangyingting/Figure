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
    <Link className="flex items-center gap-[11px] text-ink no-underline" href="/">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="grid gap-px">
        <strong className="font-display text-base tracking-[0.2em]">FIGURE</strong>
        {!compact && <small className="text-micro font-semibold text-muted">Learn what you can see.</small>}
      </span>
    </Link>
  );
}

export async function ProductShell({ children }: { children: React.ReactNode; active?: string }) {
  const user = await headerUser();
  return (
    <div className="min-h-screen bg-shell">
      <AppHeader user={user} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
