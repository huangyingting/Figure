export interface PartAnswerCount {
  partId: string;
  correct: boolean;
  count: number;
}

export interface PartAccuracy {
  partId: string;
  name: string;
  attempts: number;
  correct: number;
  accuracyPct: number;
}

/**
 * Folds grouped (partId, correct) answer counts into per-part accuracy for the
 * parts that still exist on the figure, weakest first. Parts that were removed
 * from the annotation after being quizzed are dropped rather than shown as
 * unnameable ids.
 */
export function computePartAccuracy(
  rows: PartAnswerCount[],
  parts: { id: string; name: string }[],
): PartAccuracy[] {
  const byPart = new Map<string, { attempts: number; correct: number }>();
  for (const row of rows) {
    const entry = byPart.get(row.partId) ?? { attempts: 0, correct: 0 };
    entry.attempts += row.count;
    if (row.correct) entry.correct += row.count;
    byPart.set(row.partId, entry);
  }
  return parts
    .filter((part) => byPart.has(part.id))
    .map((part) => {
      const { attempts, correct } = byPart.get(part.id)!;
      return {
        partId: part.id,
        name: part.name,
        attempts,
        correct,
        accuracyPct: attempts ? Math.round((correct / attempts) * 100) : 0,
      };
    })
    .sort((a, b) => a.accuracyPct - b.accuracyPct || b.attempts - a.attempts);
}

/** Parts worth revisiting: answered before, not yet reliably correct. */
export function weakestParts(accuracy: PartAccuracy[], limit = 4): PartAccuracy[] {
  return accuracy.filter((item) => item.accuracyPct < 100).slice(0, limit);
}
