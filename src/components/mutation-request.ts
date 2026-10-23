/** Keep transport failures on the same user-facing error path as HTTP failures. */
export async function mutationRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return Response.error();
  }
}
