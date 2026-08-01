import type { Metadata } from "next";
import { DiagramStudio } from "@/components/diagram-studio";
import { headerUser } from "@/components/product-shell";

export const metadata: Metadata = { title: "Create" };
export default async function StudioPage() {
  const user = await headerUser();
  return <DiagramStudio headerUser={user} />;
}
