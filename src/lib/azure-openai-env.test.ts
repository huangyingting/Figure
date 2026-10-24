import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { planDiagramParts } from "@/lib/azure-openai";

let directory: string;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = process.env;
  process.env = { ...originalEnv };
  directory = mkdtempSync(path.join(process.cwd(), ".figure-sdk-env-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env = originalEnv;
  rmSync(directory, { recursive: true });
});

describe("authoritative configuration at the Azure SDK request boundary", () => {
  it.each(["responses", "chat-completions"])(
    "ignores inherited SDK credentials, headers and routing metadata with %s",
    async (api) => {
      writeFileSync(path.join(directory, ".env"), [
        "AZURE_AUTH_MODE=api-key",
        "AZURE_VISION_ENDPOINT=https://vision.example.invalid",
        "AZURE_VISION_API_KEY=file-vision-key",
        "AZURE_VISION_DEPLOYMENT=file-vision-deployment",
        `AZURE_VISION_API=${api}`,
        `AZURE_IMAGE_MODELS='${JSON.stringify([{
          id: "file-image",
          label: "File image",
          api: "openai",
          endpoint: "https://image.example.invalid",
          deployment: "file-image-deployment",
          authMode: "entra",
        }])}'`,
      ].join("\n"));
      vi.spyOn(process, "cwd").mockReturnValue(directory);
      Object.assign(process.env, {
        OPENAI_API_KEY: "inherited-sdk-key",
        OPENAI_ADMIN_KEY: "inherited-admin-key",
        OPENAI_BASE_URL: "https://wrong.example.invalid",
        OPENAI_CUSTOM_HEADERS: "Authorization: Bearer inherited-header\nX-Inherited-Header: wrong-source",
        OPENAI_ORG_ID: "inherited-org",
        OPENAI_PROJECT_ID: "inherited-project",
      });
      const plan = {
        title: "Pump",
        diagramType: "cutaway",
        audience: "learners",
        visualDirection: "A pump.",
        parts: ["case", "shaft", "seal", "rotor"].map((id) => ({ id, name: id, description: id })),
      };
      const payload = api === "responses"
        ? { object: "response", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(plan) }] }] }
        : { choices: [{ message: { content: JSON.stringify(plan) } }] };
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      }));
      vi.stubGlobal("fetch", fetchMock);

      expect((await planDiagramParts({ subject: "Pump", locale: "en", visualStyle: "isometric" })).title)
        .toBe("Pump");

      const [request, options] = fetchMock.mock.calls[0] as [string | Request, RequestInit];
      const url = request instanceof Request ? request.url : String(request);
      expect(url).toBe(`https://vision.example.invalid/openai/v1/${api === "responses" ? "responses" : "chat/completions"}`);
      const headers = new Headers(options.headers);
      expect(headers.get("authorization")).toBe("Bearer file-vision-key");
      expect(headers.get("openai-organization")).toBeNull();
      expect(headers.get("openai-project")).toBeNull();
      expect(headers.get("x-inherited-header")).toBeNull();
      expect(JSON.parse(String(options.body)).model).toBe("file-vision-deployment");
    },
  );
});
