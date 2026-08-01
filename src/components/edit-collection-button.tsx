"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CustomSelect } from "@/components/custom-select";
import { Button, Field, FieldError, Input, Textarea } from "@/components/ui";
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
      <Button variant="outline" onClick={open}>
        <Pencil size={15} />Edit
      </Button>
      {editing && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgb(26_25_20_/_55%)] p-[25px] backdrop-blur-[7px]" role="presentation" onClick={() => setEditing(false)}>
          <section ref={dialogRef} className="relative w-[min(460px,100%)] rounded-[17px] bg-paper p-[30px] shadow-[0_30px_90px_rgb(0_0_0_/_28%)]" role="dialog" aria-modal="true" aria-labelledby="edit-collection-title" onClick={(event) => event.stopPropagation()}>
            <button className="absolute right-4 top-4 grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg border-0 bg-[#f1ebdd] [&_svg]:w-4" type="button" onClick={() => setEditing(false)} aria-label="Close"><X /></button>
            <p className="eyebrow m-0">EDIT COLLECTION</p>
            <h2 className="mb-[22px] mt-[7px] font-display text-[29px] tracking-[-0.015em]" id="edit-collection-title">Refine this collection.</h2>
            <form className="grid gap-[14px]" action={submit}>
              <Field label="Name"><Input name="name" required minLength={2} maxLength={60} defaultValue={name} placeholder="e.g. Mechanical systems" /></Field>
              <Field label="Description"><Textarea name="description" rows={3} maxLength={180} defaultValue={description ?? ""} placeholder="What belongs in this collection?" /></Field>
              <CustomSelect label="Color" value={tone} onChange={setTone} options={[{ value: "violet", label: "Deep pine" }, { value: "coral", label: "Warm coral" }, { value: "acid", label: "Marigold" }, { value: "blue", label: "Blueprint blue" }]} />
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
