/** Raised when a request body exceeds the configured byte cap. */
export class BodyTooLargeError extends Error {
  constructor(public readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes.`);
    this.name = "BodyTooLargeError";
  }
}

/**
 * Reads a request body as text while enforcing a hard byte cap, so a chunked
 * request that omits Content-Length cannot buffer an unbounded body into
 * memory. Returns the decoded string, or throws BodyTooLargeError once the cap
 * is exceeded.
 */
export async function readBodyText(request: Request, limitBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limitBytes) {
    throw new BodyTooLargeError(limitBytes);
  }

  const body = request.body;
  if (!body) return request.text();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limitBytes) {
        throw new BodyTooLargeError(limitBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new TextDecoder().decode(concat(chunks, total));
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Reads and JSON-parses a request body under a byte cap. */
export async function readJson(request: Request, limitBytes: number): Promise<unknown> {
  const text = await readBodyText(request, limitBytes);
  return JSON.parse(text);
}
