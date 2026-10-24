import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadApplicationEnv } from "./application-env.mjs";
import { normalizeVisionPayload } from "../src/lib/annotations";
import { getAzureConfig, getAzureModelDeployments } from "../src/lib/azure-config";
import {
  generateAzureImage,
  locateDiagramParts,
} from "../src/lib/azure-openai";
import type {
  DiagramResult,
  GenerateDiagramRequest,
} from "../src/lib/contracts";

const demoBrief: Omit<GenerateDiagramRequest, "imageModel"> = {
  locale: "en",
  subject: "Inside a single-stage end-suction centrifugal pump",
  diagramType: "cutaway",
  audience: "curious adult learners and engineering students",
  visualStyle: "isometric",
  visualDirection:
    "Create a stylish isometric cutaway of one physically plausible centrifugal pump. Use a clean orthographic view from slightly above: the large inlet flange faces left, the discharge flange rises vertically, the impeller sits visibly inside the volute, and the shaft, mechanical seal, and bearing housing extend to the right. Use a sculpted teal casing with a precise section removed, a warm coral-orange impeller, a graphite shaft, and subtle sage accents. Preserve crisp component separation and physical relationships. Do not include a motor, attached piping, mounting floor, scenery, labels, arrows, text, or a drop shadow.",
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
  loadApplicationEnv();
  const demoRequest: GenerateDiagramRequest = {
    ...demoBrief,
    imageModel: getAzureConfig().defaultImageModel,
  };

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
      ...getAzureModelDeployments(demoRequest.imageModel),
      generatedAt: new Date().toISOString(),
      reviewRequired: true,
      visualStyle: demoRequest.visualStyle,
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
