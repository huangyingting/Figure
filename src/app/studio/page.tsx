import type { Metadata } from "next";
import { DiagramStudio } from "@/components/diagram-studio";

export const metadata: Metadata = { title: "Create" };
export default function StudioPage() { return <DiagramStudio />; }
