import { Plus, Shapes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LibraryControls } from "@/components/library-controls";
import { ProductShell } from "@/components/product-shell";
import { Button, EmptyState, Page, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "My figures" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth(); if (!session?.user?.id) redirect("/signin?callbackUrl=/library");
  const figures = await prisma.figure.findMany({ where: { ownerId: session.user.id }, orderBy: { createdAt: "desc" }, take: 120, select: { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } } });
  return <ProductShell active="/library"><Page>
    <PageHeader
      eyebrow={<><Shapes size={14} /> PERSONAL LIBRARY</>}
      title="Your figures"
      lead="Every visual you generate is saved here automatically."
      actions={<Button asChild><Link href="/studio"><Plus size={17} />New figure</Link></Button>}
    />
    {figures.length
      ? <LibraryControls figures={figures} />
      : <EmptyState large icon="✦" title="Your first idea belongs here." description="Generate an annotated visual and it will be saved to your personal library." action={<Button asChild><Link href="/studio">Create a figure</Link></Button>} />}
  </Page></ProductShell>;
}
