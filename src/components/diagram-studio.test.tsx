import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DiagramStudio } from "@/components/diagram-studio";

vi.mock("next/navigation", () => ({ usePathname: () => "/studio" }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user", name: "Ada", email: "ada@example.com", credits: 12 } },
    update: vi.fn(),
  }),
  signOut: vi.fn(),
}));

describe("DiagramStudio visual style", () => {
  it("defaults new generations to isometric while keeping the sample editable", () => {
    const markup = renderToStaticMarkup(
      <DiagramStudio headerUser={{ name: "Ada", email: "ada@example.com", credits: 12 }} />,
    );

    expect(markup).toContain('aria-label="Visual style"');
    expect(markup).toContain("Isometric");
    expect(markup).toContain("Realistic");
    expect(markup).toContain("Export JSON");
    expect(markup).toContain("Drag a marker to refine its anchor");
  });
});
