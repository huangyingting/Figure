import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

import demo from "../src/lib/demo-pump.generated.json" with { type: "json" };

const databaseUrl = `file:${path.join(process.cwd(), ".e2e/test.db")}`;
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const demoPath = `/figures/${demo.id}`;

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill("demo@figure.local");
  await page.getByLabel(/^password$/i).fill("figure-demo");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/library/);
}

test.afterAll(async () => { await prisma.$disconnect(); });
test.beforeEach(async ({ context }, info) => {
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": `192.0.2.${info.line % 100 + (info.project.name === "mobile" ? 100 : 0)}` });
});

test("public browsing, private route gating, and responsive navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await page.goto("/discover");
  await expect(page.getByRole("link", { name: /Single-stage end-suction/ }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search public figures", exact: true }).fill("centrifugal");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=centrifugal/);
  await page.getByRole("combobox", { name: "Sort by", exact: true }).click();
  await page.getByRole("option", { name: "Newest", exact: true }).click();
  await expect(page).toHaveURL(/q=centrifugal/);
  await expect(page.getByRole("link", { name: /Single-stage end-suction/ }).first()).toBeVisible();
  await page.goto(demoPath);
  await expect(page.getByRole("heading", { name: demo.annotation.title }).first()).toBeVisible();
  const image = page.locator(`img[src*="${demo.id}"]`).first();
  await expect(image).toBeVisible();
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  const author = await prisma.user.findUniqueOrThrow({ where: { email: "demo@figure.local" } });
  await page.goto(`/authors/${author.id}`);
  await expect(page.locator(`a[href="${demoPath}"]`).first()).toBeVisible();
  for (const route of ["/library", "/collections", "/credits", "/account", "/favorites"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
  }
  await page.goto("/quiz");
  await expect(page.getByRole("main")).toBeVisible();
  await page.goto("/studio");
  await expect(page.getByRole("main")).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.context().addCookies([{ name: "figure_locale", value: "zh-CN", url: new URL(page.url()).origin }]);
  await page.goto(demoPath);
  await expect(page.getByRole("heading", { name: "单级端吸离心泵剖视图" }).first()).toBeVisible();
});

test("saved figures, collection membership, favorites, revisions and quiz persistence", async ({ page }) => {
  await signIn(page);
  const request = page.request;
  const duplicateResponse = await request.post(`/api/figures/${demo.id}/duplicate`);
  expect(duplicateResponse.status()).toBe(201);
  const duplicate = await duplicateResponse.json() as { id: string };
  const figureId = duplicate.id;
  const figurePath = `/figures/${figureId}`;
  const original = await (await request.get(`/api/figures/${figureId}`)).json();
  expect(original.annotation.parts).toHaveLength(demo.annotation.parts.length);
  await page.goto(figurePath);
  await expect(page.getByRole("main")).toBeVisible();

  const invalid = await request.patch(`/api/figures/${figureId}`, { data: { isPublic: "yes" } });
  expect(invalid.status()).toBe(400);
  const rename = await request.patch(`/api/figures/${figureId}`, { data: { title: "Browser verified lesson" } });
  expect(rename.ok()).toBe(true);
  expect((await (await request.get(`/api/figures/${figureId}`)).json()).annotation.title).toBe("Browser verified lesson");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Browser verified lesson" }).first()).toBeVisible();
  await page.goto("/library");
  await page.getByRole("textbox", { name: "Search your figures", exact: true }).fill("Browser verified lesson");
  await expect(page.locator(`a[href="${figurePath}"]`).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search your figures", exact: true }).fill("no-figure-has-this-subject");
  await expect(page.locator(`a[href="${figurePath}"]`)).toHaveCount(0);

  const history = (await (await request.get(`/api/figures/${figureId}/revisions`)).json()).revisions as { id: string; source: string }[];
  expect(history.some((revision) => revision.source === "human-edit")).toBe(true);
  const draft = history.find((revision) => revision.source === "ai-draft");
  expect(draft).toBeDefined();
  const restore = await request.post(`/api/figures/${figureId}/revisions`, { data: { revisionId: draft!.id } });
  expect(restore.ok()).toBe(true);
  expect((await (await request.get(`/api/figures/${figureId}`)).json()).annotation.title).toBe(original.annotation.title);

  const favorite = await request.post(`/api/figures/${figureId}/favorite`);
  expect(favorite.ok()).toBe(true);
  await page.goto("/favorites");
  await expect(page.locator(`a[href="${figurePath}"]`).first()).toBeVisible();
  expect((await request.delete(`/api/figures/${figureId}/favorite`)).ok()).toBe(true);

  const collectionResponse = await request.post("/api/collections", { data: { name: `Browser collection ${test.info().project.name}`, color: "violet" } });
  expect(collectionResponse.status()).toBe(201);
  const collection = (await collectionResponse.json()).collection as { id: string };
  expect((await request.post(`/api/collections/${collection.id}/figures`, { data: { figureId } })).ok()).toBe(true);
  await page.goto(`/collections/${collection.id}`);
  await expect(page.locator(`a[href="${figurePath}"]`).first()).toBeVisible();
  expect((await request.patch(`/api/collections/${collection.id}`, { data: { name: "Renamed collection", color: "blue" } })).ok()).toBe(true);

  const visible = original.annotation.parts.filter((part: { visible: boolean }) => part.visible) as { id: string }[];
  const quiz = await request.post("/api/quiz-attempts", { data: {
    figureId, answers: visible.map((part) => ({ partId: part.id, answer: part.id })),
  } });
  expect(quiz.status()).toBe(201);
  const attempt = await prisma.quizAttempt.findFirstOrThrow({ where: { figureId } });
  expect(attempt.score).toBe(visible.length);
  expect(attempt.total).toBe(visible.length);
  expect(await prisma.quizAnswer.count({ where: { attemptId: attempt.id } })).toBe(visible.length);
  await page.goto(`/quiz?figure=${figureId}`);
  await expect(page.getByRole("main")).toBeVisible();

  expect((await request.delete(`/api/collections/${collection.id}/figures`, { data: { figureId } })).ok()).toBe(true);
  expect((await request.delete(`/api/collections/${collection.id}`)).ok()).toBe(true);
  expect((await request.delete(`/api/figures/${figureId}`)).ok()).toBe(true);
  expect((await request.get(`/api/figures/${figureId}`)).status()).toBe(404);
  expect(await prisma.quizAnswer.count({ where: { attemptId: attempt.id } })).toBe(0);
  expect((await request.get(`/api/figures/${demo.id}/image`)).ok()).toBe(true);
});

test("generation success, explicit failure refund, and relational invariants", async ({ page }) => {
  await signIn(page);
  const request = page.request;
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo@figure.local" } });
  await page.goto("/credits");
  await expect(page.getByRole("main")).toContainText(/credit/i);
  const input = {
    subject: "Pump browser verification", locale: "en", diagramType: "cutaway",
    audience: "curious learners", imageModel: "gpt-image-2", visualStyle: "realistic",
    parts: demo.annotation.parts.map(({ id, name, description }) => ({ id, name, description })),
  };
  const plan = await request.post("/api/plan", { data: { subject: input.subject, visualStyle: input.visualStyle } });
  expect(plan.ok()).toBe(true);
  expect((await plan.json()).parts.length).toBeGreaterThan(1);
  const generated = await request.post("/api/generate", { data: input, timeout: 60_000 });
  expect(generated.ok()).toBe(true);
  const result = await generated.json();
  expect(result.provenance.visualStyle).toBe("realistic");
  expect((await prisma.figure.findUniqueOrThrow({ where: { id: result.id } })).visualStyle).toBe("realistic");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits).toBe(user.credits - 1);
  expect((await request.get(result.image.src)).ok()).toBe(true);
  await page.goto(`/figures/${result.id}`);
  await expect(page.getByRole("heading", { name: result.annotation.title }).first()).toBeVisible();
  const failed = await request.post("/api/generate", { data: { ...input, subject: "Simulate provider failure" } });
  expect(failed.status()).toBe(502);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits).toBe(user.credits - 1);
  const failedRequestId = (await failed.json()).requestId as string;
  expect(await prisma.creditLedger.count({ where: { userId: user.id, referenceId: failedRequestId } })).toBe(2);
  const ledger = await prisma.creditLedger.aggregate({ where: { userId: user.id }, _sum: { amount: true } });
  expect(ledger._sum.amount).toBe(user.credits - 1);

  const attempt = await prisma.quizAttempt.create({ data: { userId: user.id, figureId: result.id, score: 0, total: 1 } });
  await expect(prisma.quizAnswer.create({ data: {
    attemptId: attempt.id, userId: user.id, figureId: demo.id, partId: "case", answer: "case", correct: true,
  } })).rejects.toMatchObject({ code: "P2003" });
  const charge = await prisma.creditLedger.findFirstOrThrow({ where: { userId: user.id, referenceId: result.id } });
  await expect(prisma.creditLedger.create({ data: {
    userId: charge.userId, reason: charge.reason, referenceId: charge.referenceId, amount: -1, balance: charge.balance,
  } })).rejects.toMatchObject({ code: "P2002" });
  expect((await request.delete(`/api/figures/${result.id}`)).ok()).toBe(true);
});

test("studio, annotation editing, collection creation and quiz controls work together", async ({ page }) => {
  await signIn(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  await expect(page.getByRole("combobox", { name: "Visual style", exact: true })).toContainText("Isometric");
  const imageModel = page.getByRole("combobox", { name: "Image model", exact: true });
  await expect(imageModel).toContainText("Fast image");
  await imageModel.click();
  await expect(page.getByRole("option")).toHaveCount(3);
  await page.getByRole("option", { name: test.info().project.name === "mobile" ? /MAI/ : /Detailed image/ }).click();
  const visualStyle = test.info().project.name === "mobile" ? "blueprint" : "isometric";
  if (test.info().project.name === "mobile") {
    await page.getByRole("combobox", { name: "Visual style", exact: true }).click();
    await page.getByRole("option", { name: "Blueprint", exact: true }).click();
  }
  await page.getByLabel("What do you want to explain?").fill("A pump lesson from the browser");
  await page.getByRole("button", { name: "Generate figure", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open figure page" })).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy JSON", exact: true }).click();
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).parts).toHaveLength(7);
  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toMatch(/-annotations\.json$/);
  const jsonPath = await jsonDownload.path();
  if (!jsonPath) throw new Error("The annotation download did not complete.");
  const exported = JSON.parse(await readFile(jsonPath, "utf8"));
  expect(exported.annotation.parts).toHaveLength(7);
  expect(exported.provenance.visualStyle).toBe(visualStyle);
  expect(exported.provenance.imageModel).toBe(test.info().project.name === "mobile" ? "fixture-mai" : "fixture-image");
  const imageDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Image/ }).click();
  const imageDownload = await imageDownloadPromise;
  expect(imageDownload.suggestedFilename()).toMatch(/\.png$/);
  expect(await imageDownload.failure()).toBeNull();
  await page.getByRole("link", { name: "Open figure page" }).click();
  await expect(page).toHaveURL(/\/figures\/[^/]+$/);
  const figureId = new URL(page.url()).pathname.split("/").at(-1)!;
  const figurePath = `/figures/${figureId}`;
  const original = (await (await page.request.get(`/api/figures/${figureId}`)).json()).annotation;
  expect((await prisma.figure.findUniqueOrThrow({ where: { id: figureId } })).visualStyle).toBe(visualStyle);
  const duplicateResponse = await page.request.post(`/api/figures/${figureId}/duplicate`);
  expect(duplicateResponse.status()).toBe(201);
  const duplicateId = (await duplicateResponse.json()).id as string;
  expect((await (await page.request.get(`/api/figures/${duplicateId}`)).json()).provenance.visualStyle).toBe(visualStyle);
  expect((await page.request.delete(`/api/figures/${duplicateId}`)).ok()).toBe(true);

  await page.getByRole("button", { name: "Edit annotations", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Browser casing");
  await page.getByLabel("Normalized anchor X", { exact: true }).fill("0.35");
  await page.route(`**/api/figures/${figureId}`, (route) => route.fulfill({
    status: 503, json: { error: "Temporary browser test failure" },
  }));
  await page.getByRole("button", { name: "Save edits", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save your edits." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save edits", exact: true })).toBeEnabled();
  await page.unroute(`**/api/figures/${figureId}`);
  await page.getByRole("button", { name: "Save edits", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit annotations", exact: true })).toBeVisible();
  await page.reload();
  const saved = (await (await page.request.get(`/api/figures/${figureId}`)).json()).annotation;
  expect(saved.parts[0].name).toBe("Browser casing");
  expect(saved.parts[0].anchor.x).toBeCloseTo(0.35);
  await page.getByRole("button", { name: "Rename figure", exact: true }).click();
  await page.getByLabel("Figure title", { exact: true }).fill("Browser UI lesson");
  await page.getByRole("button", { name: "Save title", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser UI lesson" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

  await page.getByRole("button", { name: "Add to favorites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove from favorites", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/favorites");
  await expect(page.locator(`a[href="${figurePath}"]`).first()).toBeVisible();
  await page.goto("/collections");
  await page.getByRole("button", { name: /^New collection/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const collectionName = `UI collection ${test.info().project.name}`;
  await dialog.getByLabel("Name", { exact: true }).fill(collectionName);
  await dialog.getByRole("button", { name: "Create collection", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto(figurePath);
  await page.getByRole("combobox", { name: "Collection", exact: true }).click();
  await page.getByRole("option", { name: collectionName, exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();

  await page.goto(`/quiz?figure=${figureId}`);
  const questions = saved.parts.filter((part: { visible: boolean }) => part.visible).slice(0, 7) as { name: string; description: string }[];
  for (const [index, part] of questions.entries()) {
    await expect(page.getByRole("heading", { name: part.description, exact: true })).toBeVisible();
    await page.getByRole("button").filter({ hasText: part.name }).click();
    await page.getByRole("button", { name: index === questions.length - 1 ? "See results" : "Next question", exact: true }).click();
  }
  await expect(page.getByText("QUIZ COMPLETE", { exact: true })).toBeVisible();
  await expect.poll(() => prisma.quizAttempt.count({ where: { figureId } })).toBe(1);
  expect((await prisma.quizAttempt.findFirstOrThrow({ where: { figureId } })).score).toBe(questions.length);

  await page.goto(figurePath);
  await page.getByRole("main").locator("summary").filter({ hasText: "Version history" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).last().click();
  await expect.poll(async () => (await (await page.request.get(`/api/figures/${figureId}`)).json()).annotation.parts[0].name).toBe(original.parts[0].name);
  const collection = await prisma.collection.findFirstOrThrow({ where: { name: collectionName } });
  await page.goto(`/collections/${collection.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editDialog = page.getByRole("dialog");
  const renamedCollection = `Renamed ${collectionName}`;
  await editDialog.getByLabel("Name", { exact: true }).fill(renamedCollection);
  await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: renamedCollection, exact: true })).toBeVisible();
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await page.getByRole("button", { name: "Delete collection", exact: true }).click();
  expect(await prisma.collection.count({ where: { id: collection.id } })).toBe(1);
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Delete collection", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/collections");
  expect((await page.request.get(`/api/figures/${figureId}`)).ok()).toBe(true);
  await page.goto(figurePath);
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  expect((await page.request.get(`/api/figures/${figureId}`)).ok()).toBe(true);
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/library");
  expect((await page.request.get(`/api/figures/${figureId}`)).status()).toBe(404);
  expect(await prisma.quizAttempt.count({ where: { figureId } })).toBe(0);
  expect(errors).toEqual([]);
});

test("registration, profile and password forms persist changes", async ({ page }) => {
  const email = `browser-${test.info().project.name}@figure.test`;
  const password = "browser-initial-password";
  const inviter = await prisma.user.findUniqueOrThrow({ where: { email: "demo@figure.local" } });
  const token = randomBytes(32).toString("hex");
  await prisma.accountInvitation.create({ data: {
    email, tokenHash: createHash("sha256").update(token).digest("hex"), invitedById: inviter.id,
    expiresAt: new Date(Date.now() + 86400000),
  } });
  await page.goto(`/invite/${token}`);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Browser learner");
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue(email);
  await page.locator('input[name="password"]:visible').fill(password);
  await page.getByRole("button", { name: "Create free account", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/library");
  await page.goto("/account");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.credits).toBe(12);
  expect(await prisma.creditLedger.count({ where: { userId: user.id, reason: "signup_bonus" } })).toBe(1);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Updated learner");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { email } })).name).toBe("Updated learner");
  await page.getByLabel("Current password", { exact: true }).filter({ visible: true }).fill(password);
  await page.getByLabel("New password", { exact: true }).filter({ visible: true }).fill("browser-updated-password");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByText("Password updated.", { exact: true })).toBeVisible();
  if (test.info().project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("dialog", { name: "Navigation menu", exact: true }).getByRole("button", { name: "Sign out", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  }
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await page.goto("/signin");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.locator('input[name="password"]:visible').fill("browser-updated-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await prisma.user.delete({ where: { id: user.id } });
});

test("invite-only admission, admin link lifecycle, and non-admin denial", async ({ page, browser }) => {
  const email = `invited-${test.info().project.name}@figure.test`;
  const password = "invited-test-password";
  const blocked = await page.request.post("/api/auth/register", { data: { name: "Uninvited", email, password } });
  expect(blocked.status()).toBe(403);
  expect(await prisma.user.count({ where: { email } })).toBe(0);
  expect((await page.request.get("/api/admin/invitations")).status()).toBe(401);
  await page.goto("/register");
  await expect(page.getByText("Figure is invite-only. Ask an administrator for an invitation.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create free account" })).toHaveCount(0);
  await signIn(page);
  await page.goto("/admin/invitations");
  await page.getByRole("textbox", { name: "Recipient email", exact: true }).fill(email);
  await page.getByRole("button", { name: "Create invitation", exact: true }).click();
  const linkField = page.getByRole("textbox", { name: "One-time invitation link", exact: true });
  await expect(linkField).toBeVisible();
  const originalLink = await linkField.inputValue();
  const row = page.getByRole("listitem").filter({ hasText: email });
  await row.getByRole("button", { name: "Replace link" }).click();
  await expect(linkField).not.toHaveValue(originalLink);
  const replacedLink = await linkField.inputValue();
  const guest = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    extraHTTPHeaders: { "X-Forwarded-For": `198.51.100.${test.info().project.name === "mobile" ? 2 : 1}` },
  });
  const invitePage = await guest.newPage();
  await invitePage.goto(originalLink);
  await expect(invitePage.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
  await row.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(row.getByText("revoked", { exact: false })).toBeVisible();
  await invitePage.goto(replacedLink);
  await expect(invitePage.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
  await row.getByRole("button", { name: "Replace link" }).click();
  await expect(linkField).not.toHaveValue(replacedLink);
  const validLink = await linkField.inputValue();
  const token = validLink.split("/").at(-1)!;
  await prisma.accountInvitation.update({ where: { email }, data: { expiresAt: new Date(0) } });
  const expired = await guest.request.post("/api/auth/register", {
    data: { name: "Expired grant", email, password, token },
  });
  expect(expired.status()).toBe(403);
  expect(await prisma.user.count({ where: { email } })).toBe(0);
  await prisma.accountInvitation.update({ where: { email }, data: { expiresAt: new Date(Date.now() + 86400000) } });
  const mismatch = await guest.request.post("/api/auth/register", {
    data: { name: "Wrong email", email: "different@figure.test", password, token },
  });
  expect(mismatch.status()).toBe(403);
  await invitePage.goto(validLink);
  await expect(invitePage.getByRole("textbox", { name: "Email", exact: true })).toHaveValue(email);
  await invitePage.getByRole("textbox", { name: "Name", exact: true }).fill("Invited learner");
  await invitePage.locator('input[name="password"]:visible').fill(password);
  await invitePage.getByRole("button", { name: "Create free account" }).click();
  await expect(invitePage).toHaveURL((url) => url.pathname === "/library");
  const member = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(member.role).toBe("member");
  expect(member.credits).toBe(12);
  expect(await prisma.creditLedger.count({ where: { userId: member.id, reason: "signup_bonus" } })).toBe(1);
  expect((await guest.request.get("/api/admin/invitations")).status()).toBe(403);
  expect((await guest.request.post("/api/admin/invitations", { data: { email: "escalated@figure.test" } })).status()).toBe(403);
  const replay = await guest.request.post("/api/auth/register", { data: { name: "Replay", email, password, token } });
  expect(replay.status()).toBe(403);
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: email }).getByText("accepted", { exact: false })).toBeVisible();
  await guest.close();
  await prisma.user.delete({ where: { id: member.id } });
});
