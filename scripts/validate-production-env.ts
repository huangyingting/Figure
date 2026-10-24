import { readApplicationEnv } from "./application-env.mjs";

const settings = readApplicationEnv();
if (settings.AUTH_URL !== "https://figure.genisisiq.com") throw new Error("AUTH_URL must be https://figure.genisisiq.com.");
if (!settings.AUTH_SECRET || settings.AUTH_SECRET.length < 32 || /replace-with|build-only/.test(settings.AUTH_SECRET)) {
  throw new Error("Set a random production AUTH_SECRET of at least 32 characters.");
}
if (settings.DATABASE_URL !== "file:/data/figure.db") throw new Error("WebStack DATABASE_URL must be file:/data/figure.db.");
if (settings.FIGURE_STORAGE !== "local" || settings.FIGURE_STORAGE_DIR !== "/data/media") {
  throw new Error("WebStack local storage must use the persistent /data/media directory.");
}
if (settings.FIGURE_INVITE_ONLY !== "true") throw new Error("WebStack must run with FIGURE_INVITE_ONLY=true.");
if (settings.AUTH_TRUST_HOST !== "true") throw new Error("Set AUTH_TRUST_HOST=true behind the WebStack Caddy proxy.");
console.log("Production environment validated; no settings or credentials were printed.");
