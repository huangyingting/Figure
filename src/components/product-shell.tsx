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
    <Link className="grid gap-[2px] text-ink no-underline" href="/">
      <span className="wordmark text-[27px]">figure</span>
      {!compact && <small className="text-micro font-semibold tracking-[0.02em] text-muted">Learn what you can see.</small>}
    </Link>
  );
}

export async function ProductShell({ children }: { children: React.ReactNode }) {
  const user = await headerUser();
  return (
    <div className="min-h-screen bg-shell">
      <AppHeader user={user} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
