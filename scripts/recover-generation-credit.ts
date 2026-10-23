import process from "node:process";

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const confirmed = args.includes("--confirm-failed-request");
const positional = args.filter((arg) => !arg.startsWith("--"));
if (
  positional.length !== 2
  || args.some((arg) => arg.startsWith("--") && !["--apply", "--confirm-failed-request"].includes(arg))
  || (apply && !confirmed)
) {
  throw new Error("Usage: npm run credits:recover -- USER_ID REQUEST_ID [--apply --confirm-failed-request]. Apply only after stopping generation traffic and verifying the request failed, not that a successful figure was deleted.");
}

const { recoverGenerationCredit } = await import("../src/lib/credits");
const { prisma } = await import("../src/lib/prisma");
try {
  const status = await recoverGenerationCredit(positional[0], positional[1], {
    before: new Date(Date.now() - 24 * 60 * 60 * 1000),
    dryRun: !apply,
  });
  console.log(JSON.stringify({ status, applied: apply && status === "refunded" }));
  if (status === "eligible-for-review") {
    console.log("Dry run only. Verify logs show an interrupted/failed request, not a deleted successful figure. Stop generation traffic before applying.");
  }
} finally {
  await prisma.$disconnect();
}
