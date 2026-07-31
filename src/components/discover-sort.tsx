"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { CustomSelect } from "@/components/custom-select";

const options = [
  { value: "popular", label: "Most explored" },
  { value: "newest", label: "Newest" },
  { value: "quizzed", label: "Most quizzed" },
];

export function DiscoverSort({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "popular") params.delete("sort");
    else params.set("sort", next);
    const query = params.toString();
    router.push(query ? `/discover?${query}` : "/discover");
  }

  return <CustomSelect compact label="Sort by" value={value} onChange={change} options={options} />;
}
