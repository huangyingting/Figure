"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CustomSelect } from "@/components/custom-select";
import { FigureCard, type FigureCardData } from "@/components/figure-card";

export function LibraryControls({ figures }: { figures: FigureCardData[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const shown = useMemo(() => figures.filter((figure) => `${figure.title} ${figure.subject}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "popular" ? b.viewCount - a.viewCount : +new Date(b.createdAt) - +new Date(a.createdAt)), [figures, query, sort]);
  return <>
    <div className="library-controls"><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your figures" /></label><CustomSelect compact label="Sort by" value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "popular", label: "Most viewed" }]} /></div>
    {shown.length ? <div className="figure-grid">{shown.map((figure, index) => <FigureCard key={figure.id} figure={figure} tone={["violet", "blue", "coral"][index % 3]} />)}</div> : <div className="empty-state"><span>⌁</span><h2>Nothing matches that search</h2><p>Try a broader phrase.</p></div>}
  </>;
}
