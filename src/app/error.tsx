"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { FigureBrand } from "@/components/product-shell";
import { Button } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_26%_18%,rgb(28_107_82/12%),transparent_26rem),#f6f1e4] px-[max(32px,calc((100vw-1100px)/2))]">
      <header className="flex min-h-[80px] items-center border-b border-line">
        <FigureBrand compact />
      </header>
      <section className="grid min-h-[calc(100vh-80px)] max-w-[640px] content-center place-content-center">
        <p className="eyebrow mb-3">Something broke</p>
        <h1 className="m-0 font-display text-[clamp(40px,5vw,62px)] font-[520] leading-[1.02] tracking-[-0.015em]">
          This view hit an unexpected error.
        </h1>
        <span className="mt-[14px] block text-lead leading-[1.6] text-muted">
          The issue has been logged. You can retry, or head back to a stable page.
          {error.digest ? ` Reference ${error.digest}.` : ""}
        </span>
        <div className="mt-[28px] flex flex-wrap gap-[10px]">
          <Button size="lg" onClick={() => reset()}>
            <RotateCcw size={17} />
            Try again
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/discover">Browse public figures</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
