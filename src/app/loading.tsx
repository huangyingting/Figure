import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div
      className="grid min-h-[60vh] content-center justify-items-center gap-4 text-muted"
      role="status"
      aria-live="polite"
    >
      <Spinner size={34} className="text-violet" />
      <p className="m-0 text-meta font-[650] tracking-[0.02em]">Loading…</p>
    </div>
  );
}
