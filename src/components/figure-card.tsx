import { BookOpenCheck, Eye, Layers3 } from "lucide-react";
import Link from "next/link";

import { cn } from "@/components/ui";

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

const toneBackgrounds: Record<string, string> = {
  violet: "bg-[#eae8ff]",
  coral: "bg-[#ffe8e1]",
  acid: "bg-[#efffc5]",
  blue: "bg-[#e0eef5]",
};

export function FigureCard({ figure, tone = "violet", readOnly = false }: { figure: FigureCardData; tone?: string; readOnly?: boolean }) {
  const href = figure.href ?? `/figures/${figure.id}`;
  const imageSrc = figure.imageSrc ?? `/api/figures/${figure.id}/image`;
  const imageClass = cn(
    "relative block aspect-[1.45] overflow-hidden p-[13px]",
    toneBackgrounds[tone] ?? toneBackgrounds.violet,
  );
  const model = <span className="absolute right-4 bottom-4 rounded-md bg-white/85 px-[9px] py-[6px] text-[10px] font-extrabold uppercase text-[#555] backdrop-blur-sm">{figure.imageModel.replace("mai-image-2.5", "MAI Image")}</span>;
  return (
    <article
      className={cn(
        "group min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-[transform,box-shadow,border-color] duration-200",
        !readOnly && "hover:-translate-y-1 hover:border-[#c8c1ff] hover:shadow-lift",
      )}
    >
      {readOnly ? (
        <div className={cn(imageClass, "cursor-default")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" className="h-full w-full rounded-[7px] bg-white object-contain" />
          {model}
        </div>
      ) : (
        <Link className={imageClass} href={href}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" className="h-full w-full rounded-[7px] bg-white object-contain transition-transform duration-[250ms] group-hover:scale-[1.025]" />
          {model}
        </Link>
      )}
      <div className="p-[18px]">
        <p className="m-0 text-micro font-extrabold uppercase tracking-[0.1em] text-violet-dark">{figure.subject}</p>
        {readOnly
          ? <h3 className="my-2 cursor-default font-display text-[21px] font-[560] leading-[1.15] tracking-[-0.04em]">{figure.title}</h3>
          : <Link href={href} className="text-ink no-underline"><h3 className="my-2 font-display text-[21px] font-[560] leading-[1.15] tracking-[-0.04em] group-hover:underline group-hover:decoration-acid group-hover:decoration-[3px] group-hover:underline-offset-[3px]">{figure.title}</h3></Link>}
        <span className="block text-ui leading-[1.5] text-muted line-clamp-2">{figure.summary}</span>
        <footer className="mt-[14px] flex items-center justify-between gap-3 border-t border-[#eee] pt-3">
          {figure.ownerId && !readOnly
            ? <Link className="flex items-center gap-[7px] text-micro text-muted no-underline hover:text-violet-dark" href={`/authors/${figure.ownerId}`}><i className="grid h-6 w-6 place-items-center rounded-full bg-violet text-[10px] font-extrabold not-italic text-white">{figure.owner?.name?.slice(0, 1) || "F"}</i>{figure.owner?.name || "Anonymous"}</Link>
            : <div className="flex items-center gap-[7px] text-micro text-muted"><i className="grid h-6 w-6 place-items-center rounded-full bg-violet text-[10px] font-extrabold not-italic text-white">{figure.owner?.name?.slice(0, 1) || "F"}</i>{figure.owner?.name || "You"}</div>}
          <div className="flex gap-[9px]"><span className="flex items-center gap-[3px] text-micro text-muted-2"><Eye size={14} />{figure.viewCount}</span><span className="flex items-center gap-[3px] text-micro text-muted-2"><Layers3 size={14} />{figure._count?.collections || 0}</span><span className="flex items-center gap-[3px] text-micro text-muted-2"><BookOpenCheck size={14} />{figure._count?.quizAttempts || 0}</span></div>
        </footer>
      </div>
    </article>
  );
}
