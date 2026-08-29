import serverless from "serverless-http";
import { createApiApp } from "../../api-app";

// Reuses the exact same routes as server.ts (used for Render/local dev) —
// nothing about /api/health, /api/sync/push, /api/gemini/extract-bill, etc.
// is duplicated or rewritten here.
let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!cachedHandler) {
    const app = await createApiApp();
    cachedHandler = serverless(app, {
      // Netlify invokes this function at /.netlify/functions/api/...; the
      // redirect in netlify.toml re-adds "/api" so this app's own routes
      // (which all start with "/api/...") still match unchanged.
      basePath: "/.netlify/functions/api",
    });
  }
  return cachedHandler;
}

export const handler = async (event: any, context: any) => {
  const fn = await getHandler();
  return fn(event, context);
};
