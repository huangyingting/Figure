"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FigureCard, type FigureCardData } from "@/components/figure-card";
import { useI18n } from "@/components/i18n-provider";
import { localizeDemoFigure } from "@/lib/demo-data";

export function CollectionFigureCard({ figure, collectionId, tone }: { figure: FigureCardData; collectionId: string; tone?: string }) {
  const { locale, t } = useI18n();
  const displayFigure = localizeDemoFigure(figure, locale);
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
      window.alert(t("Could not remove this figure from the collection."));
    }
  }

  return (
    <div className="group relative">
      <FigureCard figure={figure} tone={tone} />
      <button
        type="button"
        className="absolute right-3 top-3 z-[2] grid h-[30px] w-[30px] place-items-center rounded-full border-0 bg-[rgb(35_33_27_/_62%)] text-white opacity-0 backdrop-blur-[6px] transition-[opacity,background] duration-150 group-hover:opacity-100 hover:not-disabled:bg-[#dc2626] focus-visible:opacity-100 disabled:cursor-default disabled:opacity-50"
        aria-label={locale === "zh-CN" ? `从此收藏集中移除 ${displayFigure.title}` : `Remove ${displayFigure.title} from this collection`}
        onClick={() => void remove()}
        disabled={removing}
      >
        <X size={15} />
      </button>
    </div>
  );
}
