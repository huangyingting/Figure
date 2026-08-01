"use client";

/* eslint-disable @next/next/no-img-element */

import { FolderHeart, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomSelect } from "@/components/custom-select";
import { Button, Card, Field, FieldError, Input, Textarea } from "@/components/ui";
import { useModalDialog } from "@/components/use-modal-dialog";

interface CollectionData {
  id: string; name: string; description: string | null; color: string; updatedAt: Date;
  figures: { figure: { id: string; title: string } }[]; _count: { figures: number };
}

// Keys are the API color enum values stored per collection; tints are the
// current palette (violet/acid are legacy names kept for stored rows).
const previewTint: Record<string, string> = {
  violet: "bg-[#e1efe5]",
  coral: "bg-[#ffe8e1]",
  acid: "bg-[#ffedbc]",
  blue: "bg-[#e0eef5]",
};

export function CollectionBoard({ collections }: { collections: CollectionData[] }) {
  const router = useRouter(); const [creating, setCreating] = useState(false); const [color, setColor] = useState("violet"); const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalDialog<HTMLElement>(creating, () => setCreating(false));
  async function create(formData: FormData) {
    const response = await fetch("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), description: formData.get("description"), color }) });
    if (!response.ok) { const body = await response.json() as { error?: string }; setError(body.error || "Could not create collection."); return; }
    setCreating(false); router.refresh();
  }
  return <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button className="grid min-h-[290px] cursor-pointer place-items-center content-center rounded-[15px] border border-dashed border-line-dark bg-paper/35 p-[30px] text-ink" type="button" onClick={() => setCreating(true)}><span className="mb-[15px] grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-pine-pale text-pine"><Plus /></span><strong className="font-display text-[21px]">New collection</strong><small className="mt-[7px] max-w-[220px] text-meta leading-[1.5] text-muted">Group figures around a subject or goal.</small></button>
      {collections.map((collection) => <Card className="group min-h-[290px] overflow-hidden rounded-[15px] transition-[border-color,box-shadow,transform] duration-200 hover:border-[#b5d0be] hover:shadow-lift" key={collection.id}><Link className={`grid h-[165px] grid-cols-2 gap-1 p-3 text-pine [&>img]:h-full [&>img]:w-full [&>img]:rounded-md [&>img]:bg-paper [&>img]:object-contain [&>img:only-child]:col-span-2 [&>img:nth-child(3):last-child]:col-span-2 [&>svg]:col-span-2 [&>svg]:self-center [&>svg]:justify-self-center ${previewTint[collection.color] ?? previewTint.violet}`} href={`/collections/${collection.id}`} aria-label={`Open ${collection.name}`}>{collection.figures.length ? collection.figures.map(({ figure }) => <img key={figure.id} src={`/api/figures/${figure.id}/image`} alt="" />) : <FolderHeart size={34} />}</Link><div className="p-[17px]"><p className="m-0 text-micro font-extrabold uppercase tracking-[0.09em] text-pine-dark">{collection._count.figures} {collection._count.figures === 1 ? "figure" : "figures"}</p><h2 className="my-[6px] font-display text-[22px] tracking-[-0.015em]"><Link className="text-inherit no-underline group-hover:underline group-hover:decoration-marigold group-hover:decoration-[3px] group-hover:underline-offset-[3px]" href={`/collections/${collection.id}`}>{collection.name}</Link></h2><span className="text-meta text-muted">{collection.description || "A space for connected visual ideas."}</span></div></Card>)}
    </div>
    {creating && <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgb(26_25_20_/_55%)] p-[25px] backdrop-blur-[7px]" role="presentation" onClick={() => setCreating(false)}><section ref={dialogRef} className="relative w-[min(460px,100%)] rounded-[17px] bg-paper p-[30px] shadow-[0_30px_90px_rgb(0_0_0_/_28%)]" role="dialog" aria-modal="true" aria-labelledby="collection-title" onClick={(event) => event.stopPropagation()}><button className="absolute right-4 top-4 grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg border-0 bg-[#f1ebdd] [&_svg]:w-4" type="button" onClick={() => setCreating(false)} aria-label="Close"><X /></button><p className="eyebrow m-0">NEW COLLECTION</p><h2 className="mb-[22px] mt-[7px] font-display text-[29px] tracking-[-0.015em]" id="collection-title">Gather related ideas.</h2><form className="grid gap-[14px]" action={create}><Field label="Name"><Input name="name" required minLength={2} placeholder="e.g. Mechanical systems" /></Field><Field label="Description"><Textarea name="description" rows={3} maxLength={180} placeholder="What belongs in this collection?" /></Field><CustomSelect label="Color" value={color} onChange={setColor} options={[{ value: "violet", label: "Deep pine" }, { value: "coral", label: "Warm coral" }, { value: "acid", label: "Marigold" }, { value: "blue", label: "Blueprint blue" }]} />{error && <FieldError>{error}</FieldError>}<Button type="submit">Create collection</Button></form></section></div>}
  </>;
}
