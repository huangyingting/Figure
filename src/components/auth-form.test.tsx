import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

describe("AuthForm navigation", () => {
  it.each(["signin", "register"] as const)("keeps the intended destination when switching from %s", (mode) => {
    const markup = renderToStaticMarkup(
      <AuthForm mode={mode} social={{ google: false, facebook: false }} callbackUrl="/figures/example?tab=parts" />,
    );

    const destination = mode === "signin" ? "/register" : "/signin";
    expect(markup).toContain(`href="${destination}?callbackUrl=%2Ffigures%2Fexample%3Ftab%3Dparts"`);
  });
});
