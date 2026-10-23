-- A ledger operation has one identity, including the initial account grant.
UPDATE "CreditLedger" SET "referenceId" = 'signup'
WHERE "reason" = 'signup_bonus' AND "referenceId" IS NULL;

CREATE UNIQUE INDEX "CreditLedger_userId_reason_referenceId_key"
ON "CreditLedger"("userId", "reason", "referenceId");

CREATE UNIQUE INDEX "QuizAttempt_id_userId_figureId_key"
ON "QuizAttempt"("id", "userId", "figureId");

-- Keep the queryable copies of user/figure identity tied to their attempt.
CREATE TABLE "new_QuizAnswer" (
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "figureId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    PRIMARY KEY ("attemptId", "partId"),
    CONSTRAINT "QuizAnswer_attemptId_userId_figureId_fkey"
      FOREIGN KEY ("attemptId", "userId", "figureId")
      REFERENCES "QuizAttempt" ("id", "userId", "figureId")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_QuizAnswer" ("attemptId", "userId", "figureId", "partId", "answer", "correct")
SELECT answer."attemptId", attempt."userId", attempt."figureId",
       answer."partId", answer."answer", answer."correct"
FROM "QuizAnswer" answer JOIN "QuizAttempt" attempt ON attempt."id" = answer."attemptId";

DROP TABLE "QuizAnswer";
ALTER TABLE "new_QuizAnswer" RENAME TO "QuizAnswer";
CREATE INDEX "QuizAnswer_userId_figureId_partId_idx" ON "QuizAnswer"("userId", "figureId", "partId");
