import { Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FigureCard } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const figures = await prisma.figure.findMany({
    where: { isPublic: true, ...(q.trim() ? { OR: [{ title: { contains: q.trim() } }, { subject: { contains: q.trim() } }] } : {}) },
    orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }], take: 24,
    select: { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } },
  });
  return <ProductShell active="/discover"><main className="fx-page">
    <header className="fx-page-hero discover-hero"><div><p><Sparkles size={14} /> COMMUNITY ATLAS</p><h1>Follow your <em>curiosity.</em></h1><span>Explore visual explanations created by learners, designers, and endlessly curious minds.</span></div><Link href="/studio">Create something new</Link></header>
    <form className="discover-search" role="search"><Search size={19} /><input name="q" defaultValue={q} aria-label="Search public figures" placeholder="Search anatomy, engineering, nature…" /><button>Search</button></form>
    <div className="gallery-heading"><div><p>Trending figures</p><h2>{q ? `Results for “${q}”` : "Most explored this week"}</h2></div><span>{figures.length} visual {figures.length === 1 ? "lesson" : "lessons"}</span></div>
    {figures.length ? <div className="figure-grid">{figures.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["violet", "coral", "acid", "blue"][index % 4]} />)}</div> : <div className="empty-state"><span>✦</span><h2>No figures found</h2><p>Try another topic or create the first one.</p><Link href="/studio">Open the studio</Link></div>}
  </main></ProductShell>;
}
