"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomSelect } from "@/components/custom-select";
import { useModalDialog } from "@/components/use-modal-dialog";

interface EditCollectionButtonProps {
  collectionId: string;
  name: string;
  description: string | null;
  color: string;
}

export function EditCollectionButton({ collectionId, name, description, color }: EditCollectionButtonProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [tone, setTone] = useState(color);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dialogRef = useModalDialog<HTMLElement>(editing, () => setEditing(false));

  function open() {
    setTone(color);
    setError(null);
    setEditing(true);
  }

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: (formData.get("description") as string)?.trim() || null,
        color: tone,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Could not update the collection.");
      setPending(false);
      return;
    }
    setEditing(false);
    setPending(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="fx-edit-collection" onClick={open}>
        <Pencil size={15} />Edit
      </button>
      {editing && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditing(false)}>
          <section ref={dialogRef} className="collection-modal" role="dialog" aria-modal="true" aria-labelledby="edit-collection-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditing(false)} aria-label="Close"><X /></button>
            <p>EDIT COLLECTION</p>
            <h2 id="edit-collection-title">Refine this collection.</h2>
            <form action={submit}>
              <label><span>Name</span><input name="name" required minLength={2} maxLength={60} defaultValue={name} placeholder="e.g. Mechanical systems" /></label>
              <label><span>Description</span><textarea name="description" rows={3} maxLength={180} defaultValue={description ?? ""} placeholder="What belongs in this collection?" /></label>
              <CustomSelect label="Color" value={tone} onChange={setTone} options={[{ value: "violet", label: "Electric violet" }, { value: "coral", label: "Warm coral" }, { value: "acid", label: "Curious lime" }, { value: "blue", label: "Blueprint blue" }]} />
              {error && <p className="auth-error">{error}</p>}
              <button className="auth-submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
