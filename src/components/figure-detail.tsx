"use client";

/* eslint-disable @next/next/no-img-element */

import { BookOpenCheck, Check, FolderPlus, Globe2, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomSelect } from "@/components/custom-select";
import type { DiagramResult } from "@/lib/contracts";

export function FigureDetail({ result, owner, isPublic, collections }: { result: DiagramResult; owner: boolean; isPublic: boolean; collections: { id: string; name: string }[] }) {
  const router = useRouter(); const [selectedPart, setSelectedPart] = useState(result.annotation.parts[0]?.id || ""); const [collection, setCollection] = useState(collections[0]?.id || ""); const [saved, setSaved] = useState(false); const [publishing, setPublishing] = useState(false);
  const active = result.annotation.parts.find((part) => part.id === selectedPart);
  async function save() { if (!collection) return; const response = await fetch(`/api/collections/${collection}/figures`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ figureId: result.id }) }); if (response.ok) setSaved(true); }
  async function togglePublic() { setPublishing(true); await fetch(`/api/figures/${result.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: !isPublic }) }); router.refresh(); setPublishing(false); }
  return <>
    <header className="figure-detail-head"><div><p>{result.provenance.imageModel} · {new Date(result.provenance.generatedAt).toLocaleDateString()}</p><h1>{result.annotation.title}</h1><span>{result.annotation.summary}</span></div><div>{owner && <button onClick={() => void togglePublic()} disabled={publishing}>{isPublic ? <Globe2 /> : <Lock />}{isPublic ? "Public" : "Private"}</button>}<Link href={`/quiz?figure=${result.id}`}><BookOpenCheck />Take the quiz</Link></div></header>
    <div className="figure-detail-grid"><section className="figure-detail-canvas"><img src={result.image.src} alt={result.annotation.title} />{result.annotation.parts.filter((part) => part.visible).map((part) => <button type="button" key={part.id} data-active={part.id === selectedPart} onClick={() => setSelectedPart(part.id)} style={{ left: `${part.anchor.x * 100}%`, top: `${part.anchor.y * 100}%` }}>{part.index + 1}</button>)}</section><aside className="figure-detail-aside"><p>COMPONENT MAP</p><h2>{result.annotation.parts.length} things to notice</h2><nav>{result.annotation.parts.map((part) => <button key={part.id} data-active={part.id === selectedPart} onClick={() => setSelectedPart(part.id)}><span>{String(part.index + 1).padStart(2, "0")}</span><strong>{part.name}</strong><small>{Math.round(part.confidence * 100)}%</small></button>)}</nav>{active && <article><p>SELECTED COMPONENT</p><h3>{active.name}</h3><span>{active.description}</span><small>{active.evidence}</small></article>}</aside></div>
    {collections.length > 0 ? <section className="save-bar"><FolderPlus /><div><strong>Add this figure to a collection</strong><span>Keep connected ideas together.</span></div><CustomSelect compact label="Collection" value={collection} onChange={(value) => { setCollection(value); setSaved(false); }} options={collections.map((item) => ({ value: item.id, label: item.name }))} /><button onClick={() => void save()} disabled={saved}>{saved ? <Check /> : <Plus />}{saved ? "Saved" : "Add"}</button></section> : <section className="save-bar"><FolderPlus /><div><strong>Start a collection</strong><span>Group this figure with connected ideas.</span></div><Link href="/collections">Create collection</Link></section>}
  </>;
}
