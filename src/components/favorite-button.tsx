"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

export function FavoriteButton({ figureId, initialFavorited }: { figureId: string; initialFavorited: boolean }) {
  const { t } = useI18n();
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

  return (
    <button
      type="button"
      className={cn(
        "flex min-h-[44px] cursor-pointer items-center gap-[7px] rounded-full border px-4 text-meta font-[750] transition-[background,border-color,color] duration-150 disabled:cursor-default disabled:opacity-60",
        favorited ? "border-pine bg-pine-pale text-pine-dark" : "border-line-dark bg-paper text-ink",
      )}
      data-favorited={favorited}
      aria-pressed={favorited}
      aria-label={favorited ? t("Remove from favorites") : t("Add to favorites")}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggle(); }}
      disabled={pending}
    >
      <Heart size={16} fill={favorited ? "currentColor" : "none"} />
      {favorited ? t("Favorited") : t("Favorite")}
    </button>
  );
}
