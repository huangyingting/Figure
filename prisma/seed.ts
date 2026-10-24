import { hash } from "bcryptjs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { loadApplicationEnv } from "../scripts/application-env.mjs";
import { demoResult } from "../src/lib/demo-data";
import { FilesystemFigureStorage } from "../src/lib/storage/filesystem";

const settings = loadApplicationEnv();
if (process.env.NODE_ENV === "production") {
  throw new Error("The demo seed must not run in production.");
}
const prisma = new PrismaClient({ datasourceUrl: settings.DATABASE_URL });

async function main() {
  const email = "demo@figure.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Figure Studio", passwordHash: await hash("figure-demo", 12), credits: 24 },
  });

  // The ledger must fully explain the balance: 12 welcome credits plus a
  // 12-credit demo grant account for the seeded 24.
  if (!(await prisma.creditLedger.findFirst({ where: { userId: user.id, reason: "signup_bonus" } }))) {
    await prisma.creditLedger.create({
      data: { userId: user.id, amount: 12, balance: 12, reason: "signup_bonus", referenceId: "signup", createdAt: user.createdAt },
    });
  }
  if (!(await prisma.creditLedger.findFirst({ where: { userId: user.id, reason: "promo_grant" } }))) {
    await prisma.creditLedger.create({
      data: { userId: user.id, amount: 12, balance: 24, reason: "promo_grant", createdAt: user.createdAt },
    });
  }

  const bytes = await readFile(path.resolve("public/demo-pump.png"));
  const storage = new FilesystemFigureStorage(path.resolve(settings.FIGURE_STORAGE_DIR || ".media"));
  const stored = await storage.put(bytes, demoResult.image.mimeType, user.id);
  await prisma.figure.upsert({
    where: { id: demoResult.id },
    update: {
      title: demoResult.annotation.title,
      summary: demoResult.annotation.summary,
      imageKey: stored.storageKey,
      imageMimeType: demoResult.image.mimeType,
      imageWidth: demoResult.image.width,
      imageHeight: demoResult.image.height,
      imageModel: demoResult.provenance.imageModel,
      visionModel: demoResult.provenance.visionModel,
      annotationJson: JSON.stringify(demoResult.annotation),
      isPublic: true,
      diagramType: "cutaway",
      audience: "curious learners",
      visualStyle: demoResult.provenance.visualStyle ?? "realistic",
    },
    create: {
      id: demoResult.id, ownerId: user.id, title: demoResult.annotation.title,
      subject: "Inside a centrifugal pump", summary: demoResult.annotation.summary,
      imageKey: stored.storageKey, imageMimeType: demoResult.image.mimeType,
      imageWidth: demoResult.image.width, imageHeight: demoResult.image.height,
      imageModel: demoResult.provenance.imageModel, visionModel: demoResult.provenance.visionModel,
      annotationJson: JSON.stringify(demoResult.annotation), isPublic: true, viewCount: 128,
      diagramType: "cutaway", audience: "curious learners",
      visualStyle: demoResult.provenance.visualStyle ?? "realistic",
    },
  });

  // Every figure carries its annotation history, starting with the AI draft.
  const demoRevision = await prisma.annotationRevision.findFirst({ where: { figureId: demoResult.id } });
  if (demoRevision) {
    await prisma.annotationRevision.update({
      where: { id: demoRevision.id },
      data: { annotationJson: JSON.stringify(demoResult.annotation) },
    });
  } else {
    await prisma.annotationRevision.create({
      data: { figureId: demoResult.id, annotationJson: JSON.stringify(demoResult.annotation), source: "ai-draft" },
    });
  }

  // One finished quiz attempt (two misses) so mastery and the per-component
  // "revisit" insights render with data on first sign-in.
  const parts = demoResult.annotation.parts;
  const answers = parts.map((part, index) => {
    const missed = index < 2;
    return {
      partId: part.id,
      answer: missed ? parts[(index + 1) % parts.length].id : part.id,
      correct: !missed,
    };
  });
  await prisma.quizAttempt.upsert({
    where: { id: "seed-demo-attempt" },
    update: {},
    create: {
      id: "seed-demo-attempt",
      userId: user.id,
      figureId: demoResult.id,
      score: answers.filter((answer) => answer.correct).length,
      total: answers.length,
      answers: {
        createMany: {
          data: answers.map((answer) => ({
            partId: answer.partId,
            answer: answer.answer,
            correct: answer.correct,
          })),
        },
      },
    },
  });
}

main().finally(() => prisma.$disconnect());
