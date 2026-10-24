import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import { loadApplicationEnv } from "./application-env.mjs";

loadApplicationEnv();
const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve("prisma/package.json")), "build/index.js");
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
