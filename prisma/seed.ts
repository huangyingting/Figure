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

  // The ledger must fully explain the balance: 12 welcome credits plus a
  // 12-credit demo grant account for the seeded 24.
  if (!(await prisma.creditLedger.findFirst({ where: { userId: user.id, reason: "signup_bonus" } }))) {
    await prisma.creditLedger.create({
      data: { userId: user.id, amount: 12, balance: 12, reason: "signup_bonus", createdAt: user.createdAt },
    });
  }
  if (!(await prisma.creditLedger.findFirst({ where: { userId: user.id, reason: "promo_grant" } }))) {
    await prisma.creditLedger.create({
      data: { userId: user.id, amount: 12, balance: 24, reason: "promo_grant", createdAt: user.createdAt },
    });
  }

  const bytes = await readFile(path.resolve("public/demo-pump.svg"));
  const storage = new FilesystemFigureStorage(path.resolve(process.env.FIGURE_STORAGE_DIR || ".media"));
  const stored = await storage.put(bytes, "image/svg+xml", user.id);
  await prisma.figure.upsert({
    where: { id: demoResult.id },
    update: { isPublic: true, imageKey: stored.storageKey, diagramType: "cutaway", audience: "curious learners" },
    create: {
      id: demoResult.id, ownerId: user.id, title: demoResult.annotation.title,
      subject: "Inside a centrifugal pump", summary: demoResult.annotation.summary,
      imageKey: stored.storageKey, imageMimeType: demoResult.image.mimeType,
      imageWidth: demoResult.image.width, imageHeight: demoResult.image.height,
      imageModel: demoResult.provenance.imageModel, visionModel: demoResult.provenance.visionModel,
      annotationJson: JSON.stringify(demoResult.annotation), isPublic: true, viewCount: 128,
      diagramType: "cutaway", audience: "curious learners",
    },
  });

  // Every figure carries its annotation history, starting with the AI draft.
  if (!(await prisma.annotationRevision.findFirst({ where: { figureId: demoResult.id } }))) {
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
            userId: user.id,
            figureId: demoResult.id,
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
