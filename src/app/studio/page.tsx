import type { Metadata } from "next";
import { DiagramStudio } from "@/components/diagram-studio";
import { headerUser } from "@/components/product-shell";
import { getTranslator } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())("Create") };
}
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const [user, { subject }] = await Promise.all([headerUser(), searchParams]);
  const initialSubject = subject?.trim() ? subject.trim().slice(0, 240) : undefined;
  return <DiagramStudio headerUser={user} initialSubject={initialSubject} />;
}
