"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/components/ui";

export function FavoriteButton({ figureId, initialFavorited, variant = "detail" }: { figureId: string; initialFavorited: boolean; variant?: "detail" | "card" }) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const next = !favorited;
    setFavorited(next);
    const response = await fetch(`/api/figures/${figureId}/favorite`, { method: next ? "POST" : "DELETE" });
    setPending(false);
    if (!response.ok) {
      setFavorited(!next);
      return;
    }
    router.refresh();
  }

  const cardClass = cn(
    "absolute right-3 top-3 z-[2] grid h-8 w-8 place-items-center rounded-full border-0 backdrop-blur-[6px] transition-colors duration-150 disabled:cursor-default disabled:opacity-60",
    favorited ? "bg-paper text-[#ff5b7f]" : "bg-[rgb(35_33_27_/_55%)] text-white hover:bg-[rgb(35_33_27_/_75%)]",
  );
  const detailClass = cn(
    "flex min-h-[44px] items-center gap-[7px] rounded-lg border px-4 text-meta font-[750] transition-[background,border-color,color] duration-150 disabled:cursor-default disabled:opacity-60",
    favorited ? "border-pine bg-pine-pale text-pine-dark" : "border-line-dark bg-paper text-ink",
  );

  return (
    <button
      type="button"
      className={variant === "card" ? cardClass : detailClass}
      data-favorited={favorited}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggle(); }}
      disabled={pending}
    >
      <Heart size={variant === "card" ? 15 : 16} fill={favorited ? "currentColor" : "none"} />
      {variant === "detail" && (favorited ? "Favorited" : "Favorite")}
    </button>
  );
}
