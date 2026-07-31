"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCollectionButton({ collectionId, collectionName }: { collectionId: string; collectionName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (pending) return;
    if (!window.confirm(`Delete “${collectionName}”? The figures inside stay in your library.`)) return;
    setPending(true);
    const response = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/collections");
      router.refresh();
    } else {
      setPending(false);
      window.alert("Could not delete this collection. Please try again.");
    }
  }

  return (
    <button type="button" className="fx-delete-collection" onClick={() => void remove()} disabled={pending}>
      <Trash2 size={15} />{pending ? "Deleting…" : "Delete collection"}
    </button>
  );
}
