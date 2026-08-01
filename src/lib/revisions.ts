import type { Prisma } from "@prisma/client";

export const REVISION_HISTORY_LIMIT = 20;

export const REVISION_SOURCE_LABELS: Record<string, string> = {
  "ai-draft": "AI draft",
  "human-edit": "Edited",
  restore: "Restored",
};

/** Keeps only the newest revisions for a figure so history stays bounded. */
export async function pruneRevisions(
  tx: Prisma.TransactionClient,
  figureId: string,
  limit = REVISION_HISTORY_LIMIT,
) {
  const stale = await tx.annotationRevision.findMany({
    where: { figureId },
    orderBy: { createdAt: "desc" },
    skip: limit,
    select: { id: true },
  });
  if (stale.length) {
    await tx.annotationRevision.deleteMany({ where: { id: { in: stale.map((revision) => revision.id) } } });
  }
}
