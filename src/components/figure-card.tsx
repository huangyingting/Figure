import { BookOpenCheck, Eye, Layers3 } from "lucide-react";
import Link from "next/link";

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

export function FigureCard({ figure, tone = "violet", readOnly = false }: { figure: FigureCardData; tone?: string; readOnly?: boolean }) {
  const href = figure.href ?? `/figures/${figure.id}`;
  const imageSrc = figure.imageSrc ?? `/api/figures/${figure.id}/image`;
  return (
    <article className="figure-card" data-tone={tone} data-readonly={readOnly}>
      {readOnly ? (
        <div className="figure-card-image is-static">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" />
          <span>{figure.imageModel.replace("mai-image-2.5", "MAI Image")}</span>
        </div>
      ) : (
        <Link className="figure-card-image" href={href}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" />
          <span>{figure.imageModel.replace("mai-image-2.5", "MAI Image")}</span>
        </Link>
      )}
      <div className="figure-card-copy">
        <p>{figure.subject}</p>
        {readOnly ? <h3>{figure.title}</h3> : <Link href={href}><h3>{figure.title}</h3></Link>}
        <span>{figure.summary}</span>
        <footer>
          {figure.ownerId && !readOnly
            ? <Link className="figure-author" href={`/authors/${figure.ownerId}`}><i>{figure.owner?.name?.slice(0, 1) || "F"}</i>{figure.owner?.name || "Anonymous"}</Link>
            : <div className="figure-author"><i>{figure.owner?.name?.slice(0, 1) || "F"}</i>{figure.owner?.name || "You"}</div>}
          <div><span><Eye size={14} />{figure.viewCount}</span><span><Layers3 size={14} />{figure._count?.collections || 0}</span><span><BookOpenCheck size={14} />{figure._count?.quizAttempts || 0}</span></div>
        </footer>
      </div>
    </article>
  );
}
