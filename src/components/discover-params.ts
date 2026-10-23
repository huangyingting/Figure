export function normalizeDiscoverParams(params: {
  q?: string | string[];
  sort?: string | string[];
  page?: string | string[];
}) {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const q = first(params.q).trim().slice(0, 120);
  const requestedSort = first(params.sort);
  const sort = ["popular", "newest", "quizzed"].includes(requestedSort)
    ? requestedSort
    : "popular";
  const requestedPage = first(params.page);
  const parsedPage = /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 10000
    ? parsedPage
    : 1;
  return { q, sort, page };
}
