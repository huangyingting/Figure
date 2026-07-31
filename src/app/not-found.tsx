import { Compass, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FigureBrand } from "@/components/product-shell";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <main className="notfound-page">
    <header><FigureBrand /></header>
    <section>
      <p>404 · NOTHING HERE</p>
      <h1>This figure went off the page.</h1>
      <span>The link may be broken, or the figure is private and belongs to someone else.</span>
      <div>
        <Link className="notfound-primary" href="/discover"><Compass size={17} />Browse public figures</Link>
        <Link className="notfound-secondary" href="/studio"><Plus size={17} />Create a figure</Link>
      </div>
    </section>
  </main>;
}
