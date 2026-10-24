import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

describe("AuthForm navigation", () => {
  it("does not offer public registration in invite-only mode", () => {
    const markup = renderToStaticMarkup(<AuthForm mode="signin" social={{ google: false, facebook: false }} inviteOnly />);
    expect(markup).not.toContain('href="/register');
    expect(markup).toContain("Figure is invite-only.");
  });

  it("binds invitation registration to the invited email", () => {
    const markup = renderToStaticMarkup(<AuthForm mode="register" social={{ google: false, facebook: false }} invitation={{ token: "a".repeat(64), email: "invited@example.com" }} />);
    expect(markup).toContain("Accept your invitation");
    expect(markup).toContain('value="invited@example.com"');
    expect(markup).toContain('readOnly=""');
  });
  it.each(["signin", "register"] as const)("keeps the intended destination when switching from %s", (mode) => {
    const markup = renderToStaticMarkup(
      <AuthForm mode={mode} social={{ google: false, facebook: false }} callbackUrl="/figures/example?tab=parts" />,
    );

    const destination = mode === "signin" ? "/register" : "/signin";
    expect(markup).toContain(`href="${destination}?callbackUrl=%2Ffigures%2Fexample%3Ftab%3Dparts"`);
  });
});
