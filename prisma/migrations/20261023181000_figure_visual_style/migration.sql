-- Existing images retain their original rendering; new generation requests
-- explicitly persist their selected style instead of inheriting this default.
ALTER TABLE "Figure" ADD COLUMN "visualStyle" TEXT NOT NULL DEFAULT 'realistic';
