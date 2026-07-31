import { describe, expect, it } from "vitest";

import { parsePartLines } from "@/lib/part-lines";

describe("parsePartLines", () => {
  it("preserves explicit stable IDs", () => {
    expect(
      parsePartLines("[left_atrium] 左心房 | 接收含氧血液\n主动脉 | 输送血液"),
    ).toEqual([
      { id: "left_atrium", name: "左心房", description: "接收含氧血液" },
      { id: "part_02", name: "主动脉", description: "输送血液" },
    ]);
  });

  it("rejects a line without a description separator", () => {
    expect(() => parsePartLines("泵壳\n叶轮 | 旋转部件")).toThrow(
      "第 1 行缺少",
    );
  });
});
