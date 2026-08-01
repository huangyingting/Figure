import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { makeBackgroundTransparent } from "@/lib/image-transparency";

async function rgbaImage(
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = pixel(x, y);
      data.set(value, offset);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function rawPixels(input: Buffer): Promise<Buffer> {
  return sharp(input).ensureAlpha().raw().toBuffer();
}

describe("makeBackgroundTransparent", () => {
  it("removes the edge-connected backdrop while preserving the subject", async () => {
    const input = await rgbaImage(12, 12, (x, y) =>
      x >= 3 && x <= 8 && y >= 3 && y <= 8
        ? [20, 110, 150, 255]
        : [255, 255, 255, 255],
    );

    const result = await makeBackgroundTransparent(input);
    const pixels = await rawPixels(result.bytes);

    expect(pixels[3]).toBe(0);
    expect(pixels[(6 * 12 + 6) * 4 + 3]).toBe(255);
    expect(result.transparentPixelRatio).toBeGreaterThan(0.5);
  });

  it("keeps enclosed white details opaque", async () => {
    const input = await rgbaImage(12, 12, (x, y) => {
      if (x === 6 && y === 6) return [255, 255, 255, 255];
      if (x >= 3 && x <= 8 && y >= 3 && y <= 8) return [30, 70, 95, 255];
      return [250, 250, 250, 255];
    });

    const result = await makeBackgroundTransparent(input);
    const pixels = await rawPixels(result.bytes);

    expect(pixels[(6 * 12 + 6) * 4 + 3]).toBe(255);
    expect(pixels[3]).toBe(0);
  });

  it("preserves images that already have transparent margins", async () => {
    const input = await rgbaImage(12, 12, (x, y) =>
      x >= 3 && x <= 8 && y >= 3 && y <= 8
        ? [200, 80, 40, 255]
        : [0, 0, 0, 0],
    );

    const result = await makeBackgroundTransparent(input);
    const pixels = await rawPixels(result.bytes);

    expect(pixels[3]).toBe(0);
    expect(pixels[(6 * 12 + 6) * 4 + 3]).toBe(255);
  });
});
