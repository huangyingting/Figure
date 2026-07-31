"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

  return (
    <button
      type="button"
      className={`favorite-button favorite-${variant}`}
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
