import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";
import { createApiApp } from "../api-app";

// Catches every request under /api/* (Vercel's [...path] filename convention).
// Reuses the exact same routes as server.ts (Render/local dev) and
// netlify/functions/api.ts — nothing about /api/health, /api/sync/push,
// /api/gemini/extract-bill, etc. is duplicated or rewritten here.
let appPromise: Promise<Express> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = createApiApp();
  }
  const app = await appPromise;
  return app(req as any, res as any);
}
