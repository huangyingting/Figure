import sharp from "sharp";

const solidBackdropTolerance = 14;
const featheredBackdropTolerance = 72;
const minimumBackdropRatio = 0.03;

export class BackgroundTransparencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundTransparencyError";
  }
}

export interface TransparentImage {
  bytes: Buffer;
  width: number;
  height: number;
  transparentPixelRatio: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function colorDistance(
  pixels: Buffer,
  offset: number,
  background: readonly [number, number, number],
): number {
  return Math.max(
    Math.abs(pixels[offset] - background[0]),
    Math.abs(pixels[offset + 1] - background[1]),
    Math.abs(pixels[offset + 2] - background[2]),
  );
}

function sampleCornerBackground(
  pixels: Buffer,
  width: number,
  height: number,
): readonly [number, number, number] {
  const sampleSize = Math.max(1, Math.min(8, Math.floor(width / 4), Math.floor(height / 4)));
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const starts = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ] as const;

  for (const [startX, startY] of starts) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const offset = (y * width + x) * 4;
        if (pixels[offset + 3] < 240) continue;
        red.push(pixels[offset]);
        green.push(pixels[offset + 1]);
        blue.push(pixels[offset + 2]);
      }
    }
  }

  if (!red.length) return [0, 0, 0];
  return [median(red), median(green), median(blue)];
}

function hasExistingTransparency(pixels: Buffer, pixelCount: number): boolean {
  let transparentPixels = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (pixels[index * 4 + 3] <= 16) transparentPixels += 1;
  }
  return transparentPixels / pixelCount >= minimumBackdropRatio;
}

function transparentPixelRatio(pixels: Buffer, pixelCount: number): number {
  let transparentPixels = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (pixels[index * 4 + 3] <= 16) transparentPixels += 1;
  }
  return transparentPixels / pixelCount;
}

export async function makeBackgroundTransparent(
  input: Buffer,
): Promise<TransparentImage> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixelCount = width * height;

  if (hasExistingTransparency(data, pixelCount)) {
    return {
      bytes: await sharp(data, {
        raw: { width, height, channels: 4 },
      }).png().toBuffer(),
      width,
      height,
      transparentPixelRatio: transparentPixelRatio(data, pixelCount),
    };
  }

  const background = sampleCornerBackground(data, width, height);
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  function enqueue(index: number): void {
    if (visited[index]) return;
    const offset = index * 4;
    if (colorDistance(data, offset, background) > featheredBackdropTolerance) return;
    visited[index] = 1;
    queue[queueEnd] = index;
    queueEnd += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart];
    queueStart += 1;
    const offset = index * 4;
    const distance = colorDistance(data, offset, background);
    const alphaScale = distance <= solidBackdropTolerance
      ? 0
      : (distance - solidBackdropTolerance) /
        (featheredBackdropTolerance - solidBackdropTolerance);
    data[offset + 3] = Math.min(
      data[offset + 3],
      Math.round(255 * alphaScale),
    );

    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  const ratio = transparentPixelRatio(data, pixelCount);
  if (ratio < minimumBackdropRatio) {
    throw new BackgroundTransparencyError(
      "The image model did not leave a removable uniform backdrop.",
    );
  }

  return {
    bytes: await sharp(data, {
      raw: { width, height, channels: 4 },
    }).png().toBuffer(),
    width,
    height,
    transparentPixelRatio: ratio,
  };
}
