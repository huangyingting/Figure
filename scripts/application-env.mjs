import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { parse } from "dotenv";

const applicationKey = /^(?:AZURE_|OPENAI_|AUTH_|NEXTAUTH_|FIGURE_|DATABASE_URL$)/;

export function readApplicationEnv(directory = process.cwd()) {
  const file = path.resolve(directory, ".env");
  try {
    return Object.freeze(parse(readFileSync(file)));
  } catch (error) {
    throw new Error(`Cannot read application configuration from ${file}. Create .env using .env.example; other environment files are not used.`, { cause: error });
  }
}

export function loadApplicationEnv(directory = process.cwd(), target = process.env) {
  const settings = readApplicationEnv(directory);
  for (const key of Object.keys(target)) {
    if (applicationKey.test(key)) delete target[key];
  }
  for (const [key, value] of Object.entries(settings)) {
    if (key !== "NODE_ENV" && key !== "PATH" && !key.startsWith("NEXT_RUNTIME") && !key.startsWith("__NEXT")) {
      target[key] = value;
    }
  }
  return settings;
}
