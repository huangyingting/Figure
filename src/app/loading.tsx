import { Spinner } from "@/components/ui";
import { getTranslator } from "@/lib/i18n";

export default async function Loading() {
  const t = await getTranslator();
  return (
    <div
      className="grid min-h-[60vh] content-center justify-items-center gap-4 text-muted"
      role="status"
      aria-live="polite"
    >
      <Spinner size={34} className="text-pine" />
      <p className="m-0 text-meta font-[650] tracking-[0.02em]">{t("Loading…")}</p>
    </div>
  );
}
