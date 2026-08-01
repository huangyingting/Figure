import { Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { DiscoverSort } from "@/components/discover-sort";
import { FigureCard, type FigureCardData } from "@/components/figure-card";
import { ProductShell } from "@/components/product-shell";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
import { demoResult } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

const sortOrders: Record<string, Prisma.FigureOrderByWithRelationInput[]> = {
  popular: [{ viewCount: "desc" }, { createdAt: "desc" }],
  newest: [{ createdAt: "desc" }],
  quizzed: [{ quizAttempts: { _count: "desc" } }, { createdAt: "desc" }],
};

const sampleCard: FigureCardData = {
  id: demoResult.id,
  title: demoResult.annotation.title,
  subject: "Inside a centrifugal pump",
  summary: demoResult.annotation.summary,
  imageModel: "Sample",
  viewCount: 0,
  createdAt: new Date(0),
  imageSrc: demoResult.image.src,
  href: "/studio",
  _count: { collections: 0, quizAttempts: 0 },
};

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; page?: string }> }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const { q = "", sort = "popular", page = "1" } = await searchParams;
  const activeSort = sort in sortOrders ? sort : "popular";
  const pageSize = 24;
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const where = { isPublic: true, ...(q.trim() ? { OR: [{ title: { contains: q.trim() } }, { subject: { contains: q.trim() } }] } : {}) };
  const rows = await prisma.figure.findMany({
    where,
    orderBy: sortOrders[activeSort], skip: (currentPage - 1) * pageSize, take: pageSize + 1,
    select: { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, ownerId: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } },
  });
  const hasNext = rows.length > pageSize;
  const dbFigures = rows.slice(0, pageSize);
  // Signed-out visitors always see at least the interactive sample, so the gallery is never empty.
  const showSample = !signedIn && !q.trim() && currentPage === 1 && dbFigures.length === 0;
  const figures: FigureCardData[] = showSample ? [sampleCard] : dbFigures;
  const pageQuery = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (activeSort !== "popular") params.set("sort", activeSort);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/discover?${query}` : "/discover";
  };
  const paginationLink = "inline-flex min-h-[42px] items-center rounded-[9px] border border-line-dark bg-paper px-[18px] text-micro font-bold text-ink no-underline transition-[background,border-color] duration-150 hover:bg-pine-pale hover:border-pine";
  const paginationDisabled = "inline-flex min-h-[42px] cursor-not-allowed items-center rounded-[9px] border border-line-dark bg-[#f1ebdd] px-[18px] text-micro font-bold text-muted-2";
  return <ProductShell active="/discover"><Page>
    <PageHeader
      eyebrow={<><Sparkles size={14} /> COMMUNITY ATLAS</>}
      title="Discover"
      lead="Visual explanations created by learners, designers, and endlessly curious minds."
      actions={<Button asChild><Link href="/studio">Create something new</Link></Button>}
    />
    <div className="mb-[18px] flex flex-col gap-3 lg:flex-row lg:items-center">
      <form className="flex min-h-[48px] w-full max-w-[560px] items-center gap-3 rounded-xl border border-line bg-paper py-0 pl-4 pr-[6px] shadow-[0_9px_28px_rgb(35_33_27_/_5%)]" role="search">
        <Search size={18} className="text-pine" />
        <input name="q" defaultValue={q} aria-label="Search public figures" placeholder="Search anatomy, engineering, nature…" className="min-w-0 flex-1 border-0 bg-transparent text-body outline-none placeholder:text-muted-2" />
        {activeSort !== "popular" && <input type="hidden" name="sort" value={activeSort} />}
        <button className="min-h-[36px] cursor-pointer rounded-lg border-0 bg-ink px-4 text-meta font-[750] text-white hover:bg-pine">Search</button>
      </form>
      <div className="flex items-center gap-[14px] lg:ml-auto">
        <span className="whitespace-nowrap text-meta text-muted">{figures.length} visual {figures.length === 1 ? "lesson" : "lessons"}</span>
        <DiscoverSort value={activeSort} />
      </div>
    </div>
    {q.trim() ? <p className="mb-[14px] mt-0 text-ui text-muted">Results for <strong className="text-ink">“{q.trim()}”</strong></p> : null}
    {figures.length
      ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{figures.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["pine", "coral", "marigold", "blue"][index % 4]} />)}</div>
      : <EmptyState icon="✦" title="No figures found" description="Try another topic or create the first one." action={<Button asChild><Link href="/studio">Open the studio</Link></Button>} />}
    {!showSample && (currentPage > 1 || hasNext) && <nav className="mt-[34px] flex items-center justify-center gap-[14px]" aria-label="Pagination">
      {currentPage > 1 ? <Link className={paginationLink} href={pageQuery(currentPage - 1)} rel="prev">← Previous</Link> : <span className={paginationDisabled} aria-disabled="true">← Previous</span>}
      <span className="text-micro font-bold tracking-[0.04em] text-muted">Page {currentPage}</span>
      {hasNext ? <Link className={paginationLink} href={pageQuery(currentPage + 1)} rel="next">Next →</Link> : <span className={paginationDisabled} aria-disabled="true">Next →</span>}
    </nav>}
  </Page></ProductShell>;
}
