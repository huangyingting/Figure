import { FolderHeart } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CollectionBoard } from "@/components/collection-board";
import { ProductShell } from "@/components/product-shell";
import { Page, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const session = await auth(); if (!session?.user?.id) redirect("/signin?callbackUrl=/collections");
  const collections = await prisma.collection.findMany({ where: { ownerId: session.user.id }, orderBy: { updatedAt: "desc" }, include: { figures: { take: 4, orderBy: { addedAt: "desc" }, include: { figure: { select: { id: true, title: true } } } }, _count: { select: { figures: true } } } });
  return <ProductShell><Page><PageHeader eyebrow={<><FolderHeart size={14} /> CURATED BY YOU</>} title="Collections" lead="Build a personal atlas from the figures that matter to you." /><CollectionBoard collections={collections} /></Page></ProductShell>;
}
