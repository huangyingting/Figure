import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { normalizeVisionPayload } from "../src/lib/annotations";
import {
  generateAzureImage,
  locateDiagramParts,
} from "../src/lib/azure-openai";
import type {
  DiagramResult,
  GenerateDiagramRequest,
} from "../src/lib/contracts";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as {
  loadEnvConfig: (directory: string) => unknown;
};

const demoRequest: GenerateDiagramRequest = {
  subject: "Inside a single-stage end-suction centrifugal pump",
  diagramType: "cutaway",
  audience: "curious adult learners and engineering students",
  imageModel: "gpt-image-2",
  visualDirection:
    "Create a photorealistic industrial product cutaway of one physically plausible centrifugal pump. Use a clean three-quarter view from slightly above: the large inlet flange faces left, the discharge flange rises vertically, the impeller sits visibly inside the volute, and the shaft, mechanical seal, and bearing housing extend to the right. Use a teal cast-iron casing with a precise machined section removed, a copper-orange impeller, a polished steel shaft, a brass-toned seal, and a dark graphite bearing housing. Use soft studio lighting and deep focus with crisp material detail. Do not include a motor, attached piping, mounting floor, scenery, labels, arrows, text, or a drop shadow.",
  parts: [
    {
      id: "casing",
      name: "Casing",
      description:
        "Encloses the impeller and forms the volute that converts fluid velocity into pressure.",
    },
    {
      id: "impeller",
      name: "Impeller",
      description:
        "Rotates with the shaft and transfers mechanical energy to the fluid through curved vanes.",
    },
    {
      id: "shaft",
      name: "Shaft",
      description:
        "Transfers drive torque to the impeller while maintaining its axis of rotation.",
    },
    {
      id: "seal",
      name: "Mechanical seal",
      description:
        "Restricts fluid leakage where the rotating shaft exits the pump casing.",
    },
    {
      id: "inlet",
      name: "Inlet",
      description:
        "Guides fluid axially into the low-pressure center of the impeller.",
    },
    {
      id: "outlet",
      name: "Outlet",
      description:
        "Directs pressurized fluid from the casing into the discharge pipework.",
    },
    {
      id: "bearing",
      name: "Bearing",
      description:
        "Supports the shaft, limits radial movement, and reduces rotational friction.",
    },
  ],
};

function dataUrlBytes(src: string): Buffer {
  const match = /^data:image\/png;base64,(.+)$/s.exec(src);
  if (!match) throw new Error("Demo generation did not return a PNG data URL.");
  return Buffer.from(match[1], "base64");
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  console.log("Generating the transparent pump demo…");
  const image = await generateAzureImage(demoRequest);
  const rawAnnotation = await locateDiagramParts(demoRequest, image.src);
  const annotation = normalizeVisionPayload(rawAnnotation, demoRequest);
  const result: DiagramResult = {
    id: "offline-demo-centrifugal-pump",
    image: {
      src: "/demo-pump.png",
      mimeType: "image/png",
      width: image.width,
      height: image.height,
      revisedPrompt: image.revisedPrompt,
    },
    annotation: {
      ...annotation,
      warnings: [
        ...annotation.warnings,
        "This is a curated static sample generated with Azure AI.",
      ],
    },
    provenance: {
      source: "offline-demo",
      imageModel: demoRequest.imageModel,
      visionModel: process.env.AZURE_VISION_DEPLOYMENT || "gpt-5.6-terra",
      generatedAt: new Date().toISOString(),
      reviewRequired: true,
    },
  };

  await mkdir(path.resolve("public"), { recursive: true });
  await writeFile(path.resolve("public/demo-pump.png"), dataUrlBytes(image.src));
  await writeFile(
    path.resolve("src/lib/demo-pump.generated.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    `Saved ${image.width}×${image.height} PNG and ${annotation.parts.length} grounded components.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
