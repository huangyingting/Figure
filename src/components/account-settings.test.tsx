import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AccountSettings } from "@/components/account-settings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ update: vi.fn() }) }));

describe("AccountSettings", () => {
  it.each([true, false])("provides submit controls for both forms (hasPassword=%s)", (hasPassword) => {
    const markup = renderToStaticMarkup(
      <AccountSettings name="Ada" email="ada@example.com" hasPassword={hasPassword} />,
    );

    const forms = [...markup.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)];
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form[1]).toMatch(/<button\b[^>]*type="submit"/);
    }
  });
});
