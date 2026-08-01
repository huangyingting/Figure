import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const quizFigurePageSize = 8;

export interface QuizFigureBrowserParams {
  q?: string | string[];
  page?: string | string[];
}

export interface QuizFigureBrowserItem {
  id: string;
  title: string;
  subject: string;
  createdAt: Date;
  ownerId: string | null;
  isPublic: boolean;
  quizAttempts: number;
  imageSrc?: string;
}

export interface QuizFigureBrowserResult {
  query: string;
  page: number;
  figures: QuizFigureBrowserItem[];
  hasPrevious: boolean;
  hasNext: boolean;
}

const browserFigureSelect = {
  id: true,
  title: true,
  subject: true,
  createdAt: true,
  ownerId: true,
  isPublic: true,
  _count: { select: { quizAttempts: true } },
} satisfies Prisma.FigureSelect;

const quizFigureSelect = {
  id: true,
  title: true,
  annotationJson: true,
} satisfies Prisma.FigureSelect;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function normalizeQuizFigureBrowserParams(
  params: QuizFigureBrowserParams,
): { query: string; page: number } {
  const query = first(params.q).trim().slice(0, 120);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = query && Number.isFinite(requestedPage)
    ? Math.max(1, requestedPage)
    : 1;
  return { query, page };
}

function accessibleFigureWhere(userId: string | null): Prisma.FigureWhereInput {
  return userId
    ? { OR: [{ ownerId: userId }, { isPublic: true }] }
    : { isPublic: true };
}

export async function browseQuizFigures(
  userId: string | null,
  params: QuizFigureBrowserParams,
): Promise<QuizFigureBrowserResult> {
  const { query, page } = normalizeQuizFigureBrowserParams(params);
  const access = accessibleFigureWhere(userId);
  const where: Prisma.FigureWhereInput = query
    ? {
        AND: [
          access,
          {
            OR: [
              { title: { contains: query } },
              { subject: { contains: query } },
            ],
          },
        ],
      }
    : access;
  const rows = await prisma.figure.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * quizFigurePageSize,
    take: quizFigurePageSize + 1,
    select: browserFigureSelect,
  });

  return {
    query,
    page,
    figures: rows.slice(0, quizFigurePageSize).map((figure) => ({
      id: figure.id,
      title: figure.title,
      subject: figure.subject,
      createdAt: figure.createdAt,
      ownerId: figure.ownerId,
      isPublic: figure.isPublic,
      quizAttempts: figure._count.quizAttempts,
    })),
    hasPrevious: page > 1,
    hasNext: rows.length > quizFigurePageSize,
  };
}

export async function getQuizFigure(
  userId: string | null,
  figureId?: string,
): Promise<{ id: string; title: string; annotationJson: string } | null> {
  const access = accessibleFigureWhere(userId);
  return prisma.figure.findFirst({
    where: figureId ? { AND: [access, { id: figureId }] } : access,
    ...(figureId ? {} : { orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    select: quizFigureSelect,
  });
}

export function quizFigureHref({
  figureId,
  query,
  page = 1,
}: {
  figureId?: string | null;
  query?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (figureId) params.set("figure", figureId);
  const normalizedQuery = query?.trim();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
    if (page > 1) params.set("page", String(page));
  }
  const search = params.toString();
  return search ? `/quiz?${search}` : "/quiz";
}
