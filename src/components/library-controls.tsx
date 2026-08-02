"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CustomSelect } from "@/components/custom-select";
import { FigureCard, type FigureCardData } from "@/components/figure-card";
import { EmptyState } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { localizeDemoFigure } from "@/lib/demo-data";

export function LibraryControls({ figures }: { figures: FigureCardData[] }) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const shown = useMemo(() => figures
    .map((figure) => localizeDemoFigure(figure, locale))
    .filter((figure) => `${figure.title} ${figure.subject}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "popular" ? b.viewCount - a.viewCount : +new Date(b.createdAt) - +new Date(a.createdAt)), [figures, locale, query, sort]);
  return <>
    <div className="mb-[22px] flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <label className="flex min-h-[46px] w-full items-center gap-[10px] rounded-[10px] border border-line bg-paper px-[13px] sm:w-[min(430px,60%)]">
        <Search size={18} className="text-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("Search your figures")} placeholder={t("Search your figures")} className="w-full border-0 bg-transparent text-body outline-none placeholder:text-muted-2" />
      </label>
      <CustomSelect compact label={t("Sort by")} value={sort} onChange={setSort} options={[{ value: "newest", label: t("Newest first") }, { value: "popular", label: t("Most viewed") }]} />
    </div>
    {shown.length
      ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["pine", "blue", "coral"][index % 3]} />)}</div>
      : <EmptyState icon="⌁" title={t("Nothing matches that search")} description={t("Try a broader phrase.")} />}
  </>;
}
