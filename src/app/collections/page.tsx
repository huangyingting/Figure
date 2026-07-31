import { FolderHeart } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CollectionBoard } from "@/components/collection-board";
import { ProductShell } from "@/components/product-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const session = await auth(); if (!session?.user?.id) redirect("/signin?callbackUrl=/collections");
  const collections = await prisma.collection.findMany({ where: { ownerId: session.user.id }, orderBy: { updatedAt: "desc" }, include: { figures: { take: 4, orderBy: { addedAt: "desc" }, include: { figure: { select: { id: true, title: true } } } }, _count: { select: { figures: true } } } });
  return <ProductShell active="/collections"><main className="fx-page"><header className="fx-title-row"><div><p><FolderHeart size={14} /> CURATED BY YOU</p><h1>Collections</h1><span>Build a personal atlas from the figures that matter to you.</span></div></header><CollectionBoard collections={collections} /></main></ProductShell>;
}
