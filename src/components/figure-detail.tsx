"use client";

/* eslint-disable @next/next/no-img-element */

import { BookOpenCheck, Check, Copy, FolderPlus, Globe2, Lock, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomSelect } from "@/components/custom-select";
import { FavoriteButton } from "@/components/favorite-button";
import { Button, Card, Input } from "@/components/ui";
import type { DiagramResult } from "@/lib/contracts";
import { formatGeneratedDate } from "@/lib/dates";
import { REVISION_SOURCE_LABELS } from "@/lib/revisions";
import { useI18n } from "@/components/i18n-provider";

export interface FigureRevision {
  id: string;
  source: string;
  createdAt: string;
}

export function FigureDetail({ result, owner, isPublic, collections, favorited, signedIn, facets, revisions = [] }: { result: DiagramResult; owner: boolean; isPublic: boolean; collections: { id: string; name: string }[]; favorited: boolean; signedIn: boolean; facets?: { diagramType: string | null; audience: string | null }; revisions?: FigureRevision[] }) {
  const { locale, t } = useI18n();
  const router = useRouter(); const [selectedPart, setSelectedPart] = useState(result.annotation.parts[0]?.id || ""); const [collection, setCollection] = useState(collections[0]?.id || ""); const [saved, setSaved] = useState(false); const [saving, setSaving] = useState(false); const [publishing, setPublishing] = useState(false); const [deleting, setDeleting] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false); const [titleDraft, setTitleDraft] = useState(result.annotation.title); const [renaming, setRenaming] = useState(false); const [shared, setShared] = useState(false); const [duplicating, setDuplicating] = useState(false); const [restoring, setRestoring] = useState<string | null>(null);
  const active = result.annotation.parts.find((part) => part.id === selectedPart);
  async function save() { if (!collection || saving) return; setSaving(true); const response = await fetch(`/api/collections/${collection}/figures`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ figureId: result.id }) }); setSaving(false); if (response.ok) setSaved(true); else window.alert(t("Could not add this figure to the collection. Please try again.")); }
  async function togglePublic() { if (publishing) return; setPublishing(true); const response = await fetch(`/api/figures/${result.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: !isPublic }) }); if (response.ok) { router.refresh(); } else { window.alert(t("Could not update this figure's visibility. Please try again.")); } setPublishing(false); }
  async function remove() { if (deleting) return; if (!window.confirm(t("Delete this figure permanently? This also removes it from any collections and clears its quiz history."))) return; setDeleting(true); const response = await fetch(`/api/figures/${result.id}`, { method: "DELETE" }); if (response.ok) { router.push("/library"); router.refresh(); } else { setDeleting(false); window.alert(t("Could not delete this figure. Please try again.")); } }
  function startRename() { setTitleDraft(result.annotation.title); setEditingTitle(true); }
  async function restoreRevision(revisionId: string) {
    if (restoring) return;
    setRestoring(revisionId);
    const response = await fetch(`/api/figures/${result.id}/revisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisionId }) });
    setRestoring(null);
    if (response.ok) { router.refresh(); } else { window.alert(t("Could not restore this version. Please try again.")); }
  }
  async function share() { const url = `${window.location.origin}/figures/${result.id}`; try { await navigator.clipboard.writeText(url); setShared(true); window.setTimeout(() => setShared(false), 2200); } catch { window.prompt(t("Copy this figure link:"), url); } }
  async function duplicate() { if (duplicating) return; setDuplicating(true); const response = await fetch(`/api/figures/${result.id}/duplicate`, { method: "POST" }); if (response.ok) { const body = await response.json() as { id: string }; router.push(`/figures/${body.id}`); router.refresh(); } else { setDuplicating(false); window.alert(t("Could not save a copy of this figure.")); } }
  async function saveTitle() { const trimmed = titleDraft.trim(); if (!trimmed || trimmed === result.annotation.title) { setEditingTitle(false); return; } setRenaming(true); const response = await fetch(`/api/figures/${result.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: trimmed }) }); setRenaming(false); if (response.ok) { setEditingTitle(false); router.refresh(); } else { window.alert(t("Could not rename this figure.")); } }
  return <>
    <header className="mb-5 flex flex-col items-start gap-[30px] md:flex-row md:items-end md:justify-between">
      <div className="max-w-[750px]">
        <p className="mb-[11px] flex items-center gap-[7px] text-micro font-extrabold tracking-[0.14em] text-pine-dark">
          {result.provenance.imageModel} · <time dateTime={result.provenance.generatedAt}>{formatGeneratedDate(result.provenance.generatedAt, locale)}</time>
          {facets?.diagramType ? <> · {t(facets.diagramType)}</> : null}
          {facets?.audience ? <> · {t("FOR")} {t(facets.audience).toUpperCase()}</> : null}
        </p>
        {owner && editingTitle ? (
          <div className="flex items-center gap-2">
            <Input value={titleDraft} maxLength={160} autoFocus onChange={(event) => setTitleDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveTitle(); if (event.key === "Escape") setEditingTitle(false); }} className="min-w-[min(560px,70vw)] !h-auto !rounded-[10px] !border-line-dark !py-1.5 font-display !text-[clamp(28px,4vw,44px)] font-[520] tracking-[-0.015em]" />
            <button type="button" aria-label={t("Save title")} onClick={() => void saveTitle()} disabled={renaming} className="grid h-10 w-10 cursor-pointer place-items-center rounded-[9px] border border-ink bg-ink text-white"><Check size={16} /></button>
            <button type="button" aria-label={t("Cancel")} onClick={() => setEditingTitle(false)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-[9px] border border-line-dark bg-paper text-ink"><X size={16} /></button>
          </div>
        ) : (
          <h1 className="m-0 font-display text-[clamp(36px,4.2vw,54px)] font-[520] leading-none tracking-[-0.015em]">
            {result.annotation.title}
            {owner && <button type="button" className="ml-3 rounded-[7px] p-1.5 align-middle text-muted transition-[color,background] duration-150 hover:bg-pine-pale hover:text-pine" aria-label={t("Rename figure")} onClick={startRename}><Pencil size={16} /></button>}
          </h1>
        )}
        <span className="mt-3 block text-lead leading-[1.6] text-muted">{result.annotation.summary}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {owner && <Button variant="outline" onClick={() => void togglePublic()} disabled={publishing}>{isPublic ? <Globe2 size={15} /> : <Lock size={15} />}{isPublic ? t("Public") : t("Private")}</Button>}
        {owner && <Button variant="danger" onClick={() => void remove()} disabled={deleting}><Trash2 size={16} />{deleting ? t("Deleting…") : t("Delete")}</Button>}
        {signedIn && <FavoriteButton figureId={result.id} initialFavorited={favorited} />}
        {signedIn && !owner && <Button variant="outline" onClick={() => void duplicate()} disabled={duplicating}><Copy size={16} />{duplicating ? t("Saving…") : t("Save a copy")}</Button>}
        <Button variant="outline" onClick={() => void share()} title={owner && !isPublic ? t("Link works once you make this figure public") : t("Copy a link to this figure")}>{shared ? <Check size={15} /> : <Share2 size={15} />}{shared ? t("Copied") : t("Share")}</Button>
        <Button asChild variant="primary"><Link href={`/quiz?figure=${result.id}`}><BookOpenCheck size={15} />{t("Take the quiz")}</Link></Button>
      </div>
    </header>
    <div className="grid grid-cols-1 overflow-hidden rounded-[17px] border border-line-dark bg-paper shadow-[0_23px_65px_rgb(35_33_27_/_8%)] lg:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.5fr)]">
      <section className="relative grid min-h-[380px] place-items-center bg-[#ece6d5] p-3 md:min-h-[580px] md:p-7">
        <div className="relative inline-block max-w-full leading-[0]">
          <img src={result.image.src} alt={result.annotation.title} width={result.image.width} height={result.image.height} className="block h-auto max-h-[594px] w-auto max-w-full rounded-[10px]" />
          {result.annotation.parts.filter((part) => part.visible).map((part) => <button type="button" key={part.id} aria-label={part.name} aria-pressed={part.id === selectedPart} data-active={part.id === selectedPart} onClick={() => setSelectedPart(part.id)} style={{ left: `${part.anchor.x * 100}%`, top: `${part.anchor.y * 100}%` }} className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-4 border-white bg-pine text-[11px] font-extrabold text-white shadow-[0_5px_15px_rgb(35_33_27_/_30%)] data-[active=true]:h-[35px] data-[active=true]:w-[35px] data-[active=true]:bg-marigold data-[active=true]:text-ink">{part.index + 1}</button>)}
        </div>
      </section>
      <aside className="flex max-h-[720px] flex-col border-t border-line p-6 lg:border-l lg:border-t-0">
        <p className="text-micro font-extrabold tracking-[0.12em] text-pine-dark">{t("COMPONENT MAP")}</p>
        <h2 className="mb-[17px] mt-[5px] font-display text-[23px] tracking-[-0.015em]">{result.annotation.parts.length} {t("things to notice")}</h2>
        <nav className="grid gap-1 overflow-auto">{result.annotation.parts.map((part) => <button key={part.id} aria-pressed={part.id === selectedPart} data-active={part.id === selectedPart} onClick={() => setSelectedPart(part.id)} className="grid min-h-[46px] cursor-pointer grid-cols-[30px_1fr_auto] items-center gap-[7px] rounded-[7px] bg-transparent px-[9px] text-left text-ink data-[active=true]:bg-pine-pale data-[active=true]:text-pine-dark"><span className="text-micro text-muted">{String(part.index + 1).padStart(2, "0")}</span><strong className="text-ui">{part.name}</strong><small className="text-micro text-muted">{Math.round(part.confidence * 100)}%</small></button>)}</nav>
        {active && <article className="mt-[17px] rounded-[10px] bg-[#f1ebdd] p-4"><p className="text-micro font-extrabold tracking-[0.12em] text-pine-dark">{t("SELECTED COMPONENT")}</p><h3 className="my-1.5 font-display text-[22px]">{active.name}</h3><span className="block text-ui leading-[1.55] text-ink-2">{active.description}</span><small className="mt-[11px] block border-t border-[#ded7c3] pt-2.5 text-micro leading-[1.5] text-muted">{active.evidence}</small></article>}
      </aside>
    </div>
    {owner && revisions.length > 0 && <details className="mt-[17px] rounded-2xl border border-line bg-paper px-5 py-4">
      <summary className="cursor-pointer text-ui font-bold text-ink-2">{t("Version history")} · {revisions.length}</summary>
      <ul className="m-0 mt-3 grid list-none gap-0 p-0">{revisions.map((revision, index) => (
        <li key={revision.id} className="flex min-h-[44px] items-center gap-3 border-t border-[#efe9da] text-meta text-muted">
          <strong className="w-[76px] text-ink-2">{t(REVISION_SOURCE_LABELS[revision.source] ?? revision.source)}</strong>
          <time dateTime={revision.createdAt}>{formatGeneratedDate(revision.createdAt, locale)}</time>
          {index === 0
            ? <span className="ml-auto text-micro font-bold text-green">{t("Current")}</span>
            : <button type="button" className="ml-auto cursor-pointer rounded-full border border-line-dark bg-paper px-3 py-1 text-micro font-bold text-ink hover:border-pine hover:text-pine disabled:cursor-default disabled:opacity-60" onClick={() => void restoreRevision(revision.id)} disabled={restoring !== null}>{restoring === revision.id ? t("Restoring…") : t("Restore")}</button>}
        </li>
      ))}</ul>
    </details>}
    {!signedIn ? <Card className="mt-[17px] flex flex-col items-stretch gap-3.5 px-4 py-[13px] md:flex-row md:items-center"><FolderPlus className="text-pine" /><div className="grid md:mr-auto"><strong className="text-micro">{t("Keep this figure")}</strong><span className="text-[11px] text-muted">{t("Sign in to favorite it, collect it, and track your quiz mastery.")}</span></div><Button asChild size="sm"><Link href="/signin">{t("Sign in")}</Link></Button></Card> : collections.length > 0 ? <Card className="mt-[17px] flex flex-col items-stretch gap-3.5 px-4 py-[13px] md:flex-row md:items-center"><FolderPlus className="text-pine" /><div className="grid md:mr-auto"><strong className="text-micro">{t("Add this figure to a collection")}</strong><span className="text-[11px] text-muted">{t("Keep connected ideas together.")}</span></div><CustomSelect compact label={t("Collection")} value={collection} onChange={(value) => { setCollection(value); setSaved(false); }} options={collections.map((item) => ({ value: item.id, label: item.name }))} /><Button size="sm" onClick={() => void save()} disabled={saved || saving} className="disabled:!bg-[#e7f8f1] disabled:!text-green disabled:!opacity-100">{saved ? <Check size={14} /> : <Plus size={14} />}{saved ? t("Saved") : saving ? t("Adding…") : t("Add")}</Button></Card> : <Card className="mt-[17px] flex flex-col items-stretch gap-3.5 px-4 py-[13px] md:flex-row md:items-center"><FolderPlus className="text-pine" /><div className="grid md:mr-auto"><strong className="text-micro">{t("Start a collection")}</strong><span className="text-[11px] text-muted">{t("Group this figure with connected ideas.")}</span></div><Button asChild size="sm"><Link href="/collections">{t("Create collection")}</Link></Button></Card>}
  </>;
}
