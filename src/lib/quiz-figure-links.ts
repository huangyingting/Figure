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
