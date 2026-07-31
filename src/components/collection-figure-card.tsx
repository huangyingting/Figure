"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FigureCard, type FigureCardData } from "@/components/figure-card";

export function CollectionFigureCard({ figure, collectionId, tone }: { figure: FigureCardData; collectionId: string; tone?: string }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (removing) return;
    setRemoving(true);
    const response = await fetch(`/api/collections/${collectionId}/figures`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ figureId: figure.id }),
    });
    if (response.ok) {
      router.refresh();
    } else {
      setRemoving(false);
      window.alert("Could not remove this figure from the collection.");
    }
  }

  return (
    <div className="collection-figure-slot">
      <FigureCard figure={figure} tone={tone} />
      <button
        type="button"
        className="collection-figure-remove"
        aria-label={`Remove ${figure.title} from this collection`}
        onClick={() => void remove()}
        disabled={removing}
      >
        <X size={15} />
      </button>
    </div>
  );
}
