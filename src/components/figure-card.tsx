"use client";

import { BookOpenCheck, Eye, Layers3 } from "lucide-react";
import Link from "next/link";

import { cn } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { localizeDemoFigure } from "@/lib/demo-data";

export interface FigureCardData {
  id: string;
  title: string;
  subject: string;
  summary: string;
  imageModel: string;
  viewCount: number;
  createdAt: Date;
  ownerId?: string;
  imageSrc?: string;
  href?: string;
  _count?: { collections: number; quizAttempts: number };
  owner?: { name: string | null; image: string | null };
}

/**
 * Image-well tints. "violet" and "acid" are legacy collection color values
 * stored in the database — keep them as keys, mapped onto the current tints.
 */
const toneBackgrounds: Record<string, string> = {
  pine: "bg-[#e1efe5]",
  coral: "bg-[#ffe8e1]",
  marigold: "bg-[#ffedbc]",
  blue: "bg-[#e0eef5]",
  violet: "bg-[#e1efe5]",
  acid: "bg-[#ffedbc]",
};

export function FigureCard({ figure, tone = "pine" }: { figure: FigureCardData; tone?: string }) {
  const { locale, t } = useI18n();
  const displayFigure = localizeDemoFigure(figure, locale);
  const href = displayFigure.href ?? `/figures/${displayFigure.id}`;
  const imageSrc = displayFigure.imageSrc ?? `/api/figures/${displayFigure.id}/image`;
  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-line bg-paper shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#b5d0be] hover:shadow-lift">
      <Link
        className={cn("relative block aspect-[1.45] overflow-hidden p-[13px]", toneBackgrounds[tone] ?? toneBackgrounds.pine)}
        href={href}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="" className="h-full w-full rounded-[7px] bg-paper object-contain transition-transform duration-[250ms] group-hover:scale-[1.025]" />
        <span className="absolute right-4 bottom-4 rounded-md bg-paper/85 px-[9px] py-[5px] text-[11px] font-extrabold uppercase text-muted backdrop-blur-sm">
          {displayFigure.imageModel.replace("mai-image-2.5", "MAI Image")}
        </span>
      </Link>
      <div className="p-[18px]">
        <p className="m-0 text-micro font-extrabold uppercase tracking-[0.1em] text-pine-dark">{displayFigure.subject}</p>
        <Link href={href} className="text-ink no-underline">
          <h3 className="my-2 font-display text-[23px] font-[560] leading-[1.12] tracking-[-0.015em] group-hover:underline group-hover:decoration-marigold group-hover:decoration-[3px] group-hover:underline-offset-[4px]">
            {displayFigure.title}
          </h3>
        </Link>
        <span className="block text-ui leading-[1.55] text-muted line-clamp-2">{displayFigure.summary}</span>
        <footer className="mt-[14px] flex items-center justify-between gap-3 border-t border-[#efe9da] pt-3">
          {displayFigure.ownerId
            ? <Link className="flex items-center gap-[7px] text-micro text-muted no-underline hover:text-pine-dark" href={`/authors/${displayFigure.ownerId}`}><i className="grid h-6 w-6 place-items-center rounded-full bg-pine text-micro font-extrabold not-italic text-white">{displayFigure.owner?.name?.slice(0, 1) || "F"}</i>{displayFigure.owner?.name || t("Anonymous")}</Link>
            : <div className="flex items-center gap-[7px] text-micro text-muted"><i className="grid h-6 w-6 place-items-center rounded-full bg-pine text-micro font-extrabold not-italic text-white">{displayFigure.owner?.name?.slice(0, 1) || "F"}</i>{displayFigure.owner?.name || t("You")}</div>}
          <div className="flex gap-[9px]"><span className="flex items-center gap-[3px] text-micro text-muted-2"><Eye size={14} />{displayFigure.viewCount}</span><span className="flex items-center gap-[3px] text-micro text-muted-2"><Layers3 size={14} />{displayFigure._count?.collections || 0}</span><span className="flex items-center gap-[3px] text-micro text-muted-2"><BookOpenCheck size={14} />{displayFigure._count?.quizAttempts || 0}</span></div>
        </footer>
      </div>
    </article>
  );
}
