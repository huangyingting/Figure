import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CustomSelect } from "@/components/custom-select";

describe("CustomSelect", () => {
  it("renders a custom listbox trigger instead of a native select", () => {
    const markup = renderToStaticMarkup(
      <CustomSelect
        label="Image model"
        value="gpt"
        onChange={() => undefined}
        options={[
          { value: "gpt", label: "GPT Image 2", hint: "Ready" },
          { value: "mai", label: "MAI Image 2.5", hint: "Not configured" },
        ]}
      />,
    );

    expect(markup).toContain("<button");
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("GPT Image 2");
    expect(markup).not.toContain("<select");
  });
});
