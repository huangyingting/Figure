import { describe, expect, it } from "vitest";

import { BodyTooLargeError, readBodyText, readJson } from "@/lib/http";

function streamRequest(body: string, headers: Record<string, string> = {}): Request {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Emit byte-by-byte to exercise the incremental cap without Content-Length.
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  return new Request("https://test.local/api", {
    method: "POST",
    body: stream,
    headers,
    // @ts-expect-error duplex is required by the runtime for streamed bodies.
    duplex: "half",
  });
}

describe("readBodyText", () => {
  it("reads a small body under the cap", async () => {
    const request = new Request("https://test.local/api", { method: "POST", body: "hello" });
    expect(await readBodyText(request, 1024)).toBe("hello");
  });

  it("rejects immediately when Content-Length exceeds the cap", async () => {
    const request = new Request("https://test.local/api", {
      method: "POST",
      body: "x".repeat(100),
      headers: { "content-length": "100" },
    });
    await expect(readBodyText(request, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("caps a chunked body that omits Content-Length", async () => {
    const request = streamRequest("x".repeat(50));
    await expect(readBodyText(request, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("accepts a chunked body within the cap", async () => {
    const request = streamRequest("under-cap");
    expect(await readBodyText(request, 1024)).toBe("under-cap");
  });
});

describe("readJson", () => {
  it("parses JSON under the cap", async () => {
    const request = new Request("https://test.local/api", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(await readJson(request, 1024)).toEqual({ a: 1 });
  });
});
