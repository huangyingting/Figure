import { Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DiscoverSort } from "@/components/discover-sort";
import { FigureCard } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

const sortOrders: Record<string, Prisma.FigureOrderByWithRelationInput[]> = {
  popular: [{ viewCount: "desc" }, { createdAt: "desc" }],
  newest: [{ createdAt: "desc" }],
  quizzed: [{ quizAttempts: { _count: "desc" } }, { createdAt: "desc" }],
};

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { q = "", sort = "popular" } = await searchParams;
  const activeSort = sort in sortOrders ? sort : "popular";
  const figures = await prisma.figure.findMany({
    where: { isPublic: true, ...(q.trim() ? { OR: [{ title: { contains: q.trim() } }, { subject: { contains: q.trim() } }] } : {}) },
    orderBy: sortOrders[activeSort], take: 24,
    select: { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } },
  });
  return <ProductShell active="/discover"><main className="fx-page">
    <header className="fx-page-hero discover-hero"><div><p><Sparkles size={14} /> COMMUNITY ATLAS</p><h1>Follow your <em>curiosity.</em></h1><span>Explore visual explanations created by learners, designers, and endlessly curious minds.</span></div><Link href="/studio">Create something new</Link></header>
    <form className="discover-search" role="search"><Search size={19} /><input name="q" defaultValue={q} aria-label="Search public figures" placeholder="Search anatomy, engineering, nature…" />{activeSort !== "popular" && <input type="hidden" name="sort" value={activeSort} />}<button>Search</button></form>
    <div className="gallery-heading"><div><p>Trending figures</p><h2>{q ? `Results for “${q}”` : activeSort === "newest" ? "Freshly published" : activeSort === "quizzed" ? "Most quizzed" : "Most explored this week"}</h2></div><div className="gallery-heading-meta"><span>{figures.length} visual {figures.length === 1 ? "lesson" : "lessons"}</span><DiscoverSort value={activeSort} /></div></div>
    {figures.length ? <div className="figure-grid">{figures.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["violet", "coral", "acid", "blue"][index % 4]} />)}</div> : <div className="empty-state"><span>✦</span><h2>No figures found</h2><p>Try another topic or create the first one.</p><Link href="/studio">Open the studio</Link></div>}
  </main></ProductShell>;
}
