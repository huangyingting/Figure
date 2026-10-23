import { randomBytes } from "node:crypto";
import { log } from "node:console";
import { appendFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import nextEnv from "@next/env";

if (process.env.NODE_ENV === "production") throw new Error("Local setup must not run in production.");
nextEnv.loadEnvConfig(process.cwd(), true);
const defaults = {
  DATABASE_URL: "file:./dev.db",
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  AUTH_URL: "http://localhost:3000",
};
const missing = Object.entries(defaults).filter(([key]) => !process.env[key]?.trim());
if (missing.length) {
  appendFileSync(
    path.join(process.cwd(), ".env.local"),
    `\n${missing.map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    { mode: 0o600 },
  );
}
if (process.env.AUTH_SECRET?.startsWith("replace-with-")) {
  throw new Error("Replace the template AUTH_SECRET with a random secret before starting. Existing settings were not overwritten.");
}
log(`Local setup ready. Added ${missing.length} missing setting(s); existing settings were preserved. Apply database migrations separately.`);
