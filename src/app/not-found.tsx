import { Compass, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FigureBrand } from "@/components/product-shell";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_26%_18%,rgb(28_107_82/12%),transparent_26rem),#f6f1e4] px-[max(32px,calc((100vw-1100px)/2))]">
      <header className="flex min-h-[80px] items-center border-b border-line">
        <FigureBrand />
      </header>
      <section className="grid min-h-[calc(100vh-80px)] max-w-[640px] content-center place-content-center">
        <p className="eyebrow mb-3">404 · Nothing here</p>
        <h1 className="m-0 font-display text-[clamp(40px,5vw,62px)] font-[520] leading-[1.02] tracking-[-0.015em]">
          This figure went off the page.
        </h1>
        <span className="mt-[14px] block text-lead leading-[1.6] text-muted">
          The link may be broken, or the figure is private and belongs to someone else.
        </span>
        <div className="mt-[28px] flex flex-wrap gap-[10px]">
          <Button asChild size="lg">
            <Link href="/discover">
              <Compass size={17} />
              Browse public figures
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/studio">
              <Plus size={17} />
              Create a figure
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
