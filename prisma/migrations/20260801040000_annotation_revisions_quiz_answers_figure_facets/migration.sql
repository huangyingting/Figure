-- AlterTable
ALTER TABLE "Figure" ADD COLUMN "audience" TEXT;
ALTER TABLE "Figure" ADD COLUMN "diagramType" TEXT;

-- CreateTable
CREATE TABLE "AnnotationRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "figureId" TEXT NOT NULL,
    "annotationJson" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnotationRevision_figureId_fkey" FOREIGN KEY ("figureId") REFERENCES "Figure" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "figureId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,

    PRIMARY KEY ("attemptId", "partId"),
    CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "figureId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "figureId"),
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_figureId_fkey" FOREIGN KEY ("figureId") REFERENCES "Figure" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AnnotationRevision_figureId_createdAt_idx" ON "AnnotationRevision"("figureId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizAnswer_userId_figureId_partId_idx" ON "QuizAnswer"("userId", "figureId", "partId");

-- CreateIndex
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Favorite_figureId_idx" ON "Favorite"("figureId");


-- Backfill: every existing figure gets its current annotation as the initial revision
INSERT INTO "AnnotationRevision" ("id", "figureId", "annotationJson", "source", "createdAt")
SELECT lower(hex(randomblob(16))), "id", "annotationJson", 'ai-draft', "createdAt"
FROM "Figure";

-- Backfill: normalize stored per-part answers out of QuizAttempt.answersJson
INSERT OR IGNORE INTO "QuizAnswer" ("attemptId", "userId", "figureId", "partId", "answer", "correct")
SELECT qa."id", qa."userId", qa."figureId",
       json_extract(answer.value, '$.partId'),
       json_extract(answer.value, '$.answer'),
       CASE WHEN json_extract(answer.value, '$.correct') IN (1, 'true') THEN 1 ELSE 0 END
FROM "QuizAttempt" qa, json_each(qa."answersJson") AS answer
WHERE json_extract(answer.value, '$.partId') IS NOT NULL
  AND json_extract(answer.value, '$.answer') IS NOT NULL;

-- Backfill: the ledger now explains the signup bonus behind User.credits' default
INSERT INTO "CreditLedger" ("id", "userId", "amount", "balance", "reason", "referenceId", "createdAt")
SELECT lower(hex(randomblob(16))), u."id", 12, 12, 'signup_bonus', NULL, u."createdAt"
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "CreditLedger" cl WHERE cl."userId" = u."id" AND cl."reason" = 'signup_bonus'
);
