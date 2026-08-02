"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

export function DeleteCollectionButton({ collectionId, collectionName }: { collectionId: string; collectionName: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (pending) return;
    if (!window.confirm(locale === "zh-CN" ? `删除“${collectionName}”？其中的图解仍会保留在你的图解库中。` : `Delete “${collectionName}”? The figures inside stay in your library.`)) return;
    setPending(true);
    const response = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/collections");
      router.refresh();
    } else {
      setPending(false);
      window.alert(t("Could not delete this collection. Please try again."));
    }
  }

  return (
    <Button variant="danger" onClick={() => void remove()} disabled={pending}>
      <Trash2 size={15} />{pending ? t("Deleting…") : t("Delete collection")}
    </Button>
  );
}
