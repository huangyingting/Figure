import { Plus, Shapes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LibraryControls } from "@/components/library-controls";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "My figures" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth(); if (!session?.user?.id) redirect("/signin?callbackUrl=/library");
  const figures = await prisma.figure.findMany({ where: { ownerId: session.user.id }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } } });
  return <ProductShell active="/library"><main className="fx-page"><header className="fx-title-row"><div><p><Shapes size={14} /> PERSONAL LIBRARY</p><h1>Your figures</h1><span>Every visual you generate is saved here automatically.</span></div><Link href="/studio"><Plus size={17} />New figure</Link></header>
    {figures.length ? <LibraryControls figures={figures} /> : <div className="empty-state large"><span>✦</span><h2>Your first idea belongs here.</h2><p>Generate an annotated visual and it will be saved to your personal library.</p><Link href="/studio">Create a figure</Link></div>}
  </main></ProductShell>;
}
