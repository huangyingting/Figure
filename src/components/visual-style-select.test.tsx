import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/components/i18n-provider";
import { VisualStyleSelect, visualStyleLabels } from "@/components/visual-style-select";
import type { VisualStyle } from "@/lib/contracts";

describe("VisualStyleSelect", () => {
  it.each(Object.entries(visualStyleLabels) as [VisualStyle, string][])("shows the selected %s style with an accessible compact control", (style, label) => {
    const markup = renderToStaticMarkup(
      <VisualStyleSelect value={style} onChange={() => undefined} />,
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Visual style"');
    expect(markup).toContain(label);
  });

  it("localizes the default isometric style", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider locale="zh-CN">
        <VisualStyleSelect value="isometric" onChange={() => undefined} />
      </I18nProvider>,
    );

    expect(markup).toContain('aria-label="视觉风格"');
    expect(markup).toContain("等距立体");
  });
});
