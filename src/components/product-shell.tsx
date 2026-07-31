import Link from "next/link";

import { AppHeader } from "@/components/app-header";

export function FigureBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`fx-brand${compact ? " compact" : ""}`} href="/">
      <span className="fx-brand-mark"><i /><i /><i /></span>
      <span><strong>FIGURE</strong>{!compact && <small>Learn what you can see.</small>}</span>
    </Link>
  );
}

export function ProductShell({ children }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="fx-app">
      <AppHeader />
      <div className="fx-main">{children}</div>
    </div>
  );
}
