"use client";

/* eslint-disable @next/next/no-img-element */

import { FolderHeart, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CustomSelect } from "@/components/custom-select";

interface CollectionData {
  id: string; name: string; description: string | null; color: string; updatedAt: Date;
  figures: { figure: { id: string; title: string } }[]; _count: { figures: number };
}

export function CollectionBoard({ collections }: { collections: CollectionData[] }) {
  const router = useRouter(); const [creating, setCreating] = useState(false); const [color, setColor] = useState("violet"); const [error, setError] = useState<string | null>(null);
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!creating) return;
    nameField.current?.focus();
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setCreating(false); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [creating]);
  async function create(formData: FormData) {
    const response = await fetch("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), description: formData.get("description"), color }) });
    if (!response.ok) { const body = await response.json() as { error?: string }; setError(body.error || "Could not create collection."); return; }
    setCreating(false); router.refresh();
  }
  return <>
    <div className="collection-grid">
      <button className="new-collection-card" type="button" onClick={() => setCreating(true)}><span><Plus /></span><strong>New collection</strong><small>Group figures around a subject or goal.</small></button>
      {collections.map((collection) => <article className="collection-card" data-tone={collection.color} key={collection.id}><Link className="collection-preview" href={`/collections/${collection.id}`} aria-label={`Open ${collection.name}`}>{collection.figures.length ? collection.figures.map(({ figure }) => <img key={figure.id} src={`/api/figures/${figure.id}/image`} alt="" />) : <FolderHeart size={34} />}</Link><div><p>{collection._count.figures} {collection._count.figures === 1 ? "figure" : "figures"}</p><h2><Link href={`/collections/${collection.id}`}>{collection.name}</Link></h2><span>{collection.description || "A space for connected visual ideas."}</span></div></article>)}
    </div>
    {creating && <div className="modal-backdrop" role="presentation" onClick={() => setCreating(false)}><section className="collection-modal" role="dialog" aria-modal="true" aria-labelledby="collection-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCreating(false)} aria-label="Close"><X /></button><p>NEW COLLECTION</p><h2 id="collection-title">Gather related ideas.</h2><form action={create}><label><span>Name</span><input ref={nameField} name="name" required minLength={2} placeholder="e.g. Mechanical systems" /></label><label><span>Description</span><textarea name="description" rows={3} maxLength={180} placeholder="What belongs in this collection?" /></label><CustomSelect label="Color" value={color} onChange={setColor} options={[{ value: "violet", label: "Electric violet" }, { value: "coral", label: "Warm coral" }, { value: "acid", label: "Curious lime" }, { value: "blue", label: "Blueprint blue" }]} />{error && <p className="auth-error">{error}</p>}<button className="auth-submit">Create collection</button></form></section></div>}
  </>;
}
