import { Prisma } from "@prisma/client";
import clientPackage from "@prisma/client/package.json";
import cliPackage from "prisma/package.json";
import { describe, expect, it } from "vitest";

describe("Prisma toolchain and generated schema", () => {
  it("keeps the CLI, client package and generated client on the same version", () => {
    expect(cliPackage.version).toBe(clientPackage.version);
    expect(Prisma.prismaVersion.client).toBe(clientPackage.version);
  });

  it("includes the figure visual style in the generated client", () => {
    const figure = Prisma.dmmf.datamodel.models.find((model) => model.name === "Figure");
    expect(figure?.fields.find((field) => field.name === "visualStyle")).toMatchObject({
      type: "String", isRequired: true, default: "realistic",
    });
  });

  it("generates the compound quiz-answer relation used by nested creates", () => {
    const answer = Prisma.dmmf.datamodel.models.find((model) => model.name === "QuizAnswer");
    expect(answer?.fields.find((field) => field.name === "attempt")).toMatchObject({
      relationFromFields: ["attemptId", "userId", "figureId"],
      relationToFields: ["id", "userId", "figureId"],
    });
  });
});
