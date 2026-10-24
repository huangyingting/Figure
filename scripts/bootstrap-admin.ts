import { parseArgs } from "node:util";

import { loadApplicationEnv } from "./application-env.mjs";

loadApplicationEnv();
const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string", default: "Administrator" }, "password-stdin": { type: "boolean" } },
});
if (!values.email || !values["password-stdin"] || process.stdin.isTTY) {
  throw new Error("Usage: npm run bootstrap:admin -- --email EMAIL [--name NAME] --password-stdin. Supply the password through standard input, never a command-line argument.");
}
const chunks: Buffer[] = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += Buffer.byteLength(chunk);
  if (size > 1024) throw new Error("Password input is too long.");
  chunks.push(Buffer.from(chunk));
}
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
const { bootstrapAdministrator } = await import("../src/lib/account-admission");
const { prisma } = await import("../src/lib/prisma");
try {
  await bootstrapAdministrator({ email: values.email, name: values.name, password });
  console.log("Administrator provisioned. Existing account credits and content were preserved.");
} finally {
  await prisma.$disconnect();
}
