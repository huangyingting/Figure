import { hash } from "bcryptjs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { demoResult } from "../src/lib/demo-data";
import { FilesystemFigureStorage } from "../src/lib/storage/filesystem";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@figure.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Figure Studio", passwordHash: await hash("figure-demo", 12), credits: 24 },
  });
  const bytes = await readFile(path.resolve("public/demo-pump.svg"));
  const storage = new FilesystemFigureStorage(path.resolve(process.env.FIGURE_STORAGE_DIR || ".media"));
  const stored = await storage.put(bytes, "image/svg+xml", user.id);
  await prisma.figure.upsert({
    where: { id: demoResult.id },
    update: { isPublic: true, imageKey: stored.storageKey },
    create: {
      id: demoResult.id, ownerId: user.id, title: demoResult.annotation.title,
      subject: "Inside a centrifugal pump", summary: demoResult.annotation.summary,
      imageKey: stored.storageKey, imageMimeType: demoResult.image.mimeType,
      imageWidth: demoResult.image.width, imageHeight: demoResult.image.height,
      imageModel: demoResult.provenance.imageModel, visionModel: demoResult.provenance.visionModel,
      annotationJson: JSON.stringify(demoResult.annotation), isPublic: true, viewCount: 128,
    },
  });
}

main().finally(() => prisma.$disconnect());
