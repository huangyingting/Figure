import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, figure, quizAttempt } = vi.hoisted(() => ({
  auth: vi.fn(),
  figure: { findFirst: vi.fn() },
  quizAttempt: { create: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { figure, quizAttempt } }));
vi.mock("@/lib/i18n-shared", () => ({
  requestTranslator: () => (message: string) => message,
}));

import { POST } from "./route";

const parts = [
  { id: "shaft", visible: true },
  { id: "casing", visible: true },
  { id: "hidden", visible: false },
];

function request(answers: unknown, extra: object = {}) {
  return new Request("http://localhost/api/quiz-attempts", {
    method: "POST",
    body: JSON.stringify({ figureId: "figure-1", answers, ...extra }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "user-1" } });
  figure.findFirst.mockResolvedValue({
    id: "figure-1",
    annotationJson: JSON.stringify({ parts }),
  });
  quizAttempt.create.mockResolvedValue({ id: "attempt-1", score: 1, total: 2 });
});

describe("quiz attempt persistence", () => {
  it("derives the score and normalized answer rows instead of trusting client totals", async () => {
    const response = await POST(request([
      { partId: "shaft", answer: "shaft", correct: false },
      { partId: "casing", answer: "shaft", correct: true },
    ], { score: 999, total: 999 }));

    expect(response.status).toBe(201);
    expect(quizAttempt.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        figureId: "figure-1",
        score: 1,
        total: 2,
        answers: { createMany: { data: [
          { partId: "shaft", answer: "shaft", correct: true },
          { partId: "casing", answer: "shaft", correct: false },
        ] } },
      },
    });
  });

  it.each([
    ["incomplete", [{ partId: "shaft", answer: "shaft" }]],
    ["duplicate", [{ partId: "shaft", answer: "shaft" }, { partId: "shaft", answer: "shaft" }]],
    ["unknown question", [{ partId: "shaft", answer: "shaft" }, { partId: "unknown", answer: "unknown" }]],
    ["invisible question", [{ partId: "shaft", answer: "shaft" }, { partId: "hidden", answer: "hidden" }]],
    ["unknown answer", [{ partId: "shaft", answer: "unknown" }, { partId: "casing", answer: "casing" }]],
  ])("rejects %s submissions without persisting misleading mastery data", async (_name, answers) => {
    const response = await POST(request(answers));

    expect(response.status).toBe(400);
    expect(quizAttempt.create).not.toHaveBeenCalled();
  });

  it.each(["invalid json", JSON.stringify({ parts: [] }), JSON.stringify({ parts: [{ id: "shaft", visible: false }] })])(
    "rejects attempts when stored annotations cannot produce a quiz: %s",
    async (annotationJson) => {
      figure.findFirst.mockResolvedValue({ id: "figure-1", annotationJson });

      expect((await POST(request([{ partId: "shaft", answer: "shaft" }]))).status).toBe(400);
      expect(quizAttempt.create).not.toHaveBeenCalled();
    },
  );

  it("matches the runner's first seven visible components", async () => {
    const quizParts = Array.from({ length: 8 }, (_, index) => ({ id: `part-${index}`, visible: true }));
    figure.findFirst.mockResolvedValue({ id: "figure-1", annotationJson: JSON.stringify({ parts: quizParts }) });

    const response = await POST(request(quizParts.slice(0, 7).map((part) => ({
      partId: part.id,
      answer: part.id,
    }))));

    expect(response.status).toBe(201);
    expect(quizAttempt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ score: 7, total: 7 }),
    }));
  });

  it("rejects annotations with ambiguous duplicate question ids", async () => {
    figure.findFirst.mockResolvedValue({ id: "figure-1", annotationJson: JSON.stringify({ parts: [parts[0], parts[0]] }) });

    expect((await POST(request([{ partId: "shaft", answer: "shaft" }]))).status).toBe(400);
    expect(quizAttempt.create).not.toHaveBeenCalled();
  });

  it("does not accept private or deleted figures", async () => {
    figure.findFirst.mockResolvedValue(null);

    expect((await POST(request([{ partId: "shaft", answer: "shaft" }]))).status).toBe(404);
    expect(figure.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "figure-1", OR: [{ isPublic: true }, { ownerId: "user-1" }] },
    }));
    expect(quizAttempt.create).not.toHaveBeenCalled();
  });

  it("requires authentication before reading or persisting figures", async () => {
    auth.mockResolvedValue(null);

    expect((await POST(request([]))).status).toBe(401);
    expect(figure.findFirst).not.toHaveBeenCalled();
    expect(quizAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/quiz-attempts", {
      method: "POST",
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(quizAttempt.create).not.toHaveBeenCalled();
  });
});
