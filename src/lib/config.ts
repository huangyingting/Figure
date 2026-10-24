import { loadApplicationEnv } from "../../scripts/application-env.mjs";

export function getApplicationConfig() {
  const settings = loadApplicationEnv();
  const inviteOnly = settings.FIGURE_INVITE_ONLY?.trim() || "true";
  if (!["true", "false"].includes(inviteOnly)) {
    throw new Error("FIGURE_INVITE_ONLY must be true or false.");
  }
  return {
    inviteOnly: inviteOnly === "true",
    databaseUrl: settings.DATABASE_URL,
    siteUrl: (settings.AUTH_URL || "http://localhost:3000").replace(/\/+$/, ""),
    auth: {
      secret: settings.AUTH_SECRET,
      googleId: settings.AUTH_GOOGLE_ID,
      googleSecret: settings.AUTH_GOOGLE_SECRET,
      facebookId: settings.AUTH_FACEBOOK_ID,
      facebookSecret: settings.AUTH_FACEBOOK_SECRET,
    },
    storage: {
      kind: settings.FIGURE_STORAGE || "local",
      directory: settings.FIGURE_STORAGE_DIR || ".media",
      connectionString: settings.AZURE_STORAGE_CONNECTION_STRING,
      account: settings.AZURE_STORAGE_ACCOUNT,
      key: settings.AZURE_STORAGE_KEY,
      container: settings.AZURE_STORAGE_CONTAINER || "figures",
    },
  };
}
