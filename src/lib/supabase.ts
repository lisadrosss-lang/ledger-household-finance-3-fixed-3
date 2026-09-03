import { AppState } from "../types";

const LS_SUPABASE_AUTOSYNC = "ledger_supabase_autosync";

export function getAutoSyncPreference(): boolean {
  try {
    const val = localStorage.getItem(LS_SUPABASE_AUTOSYNC);
    if (val === null) {
      localStorage.setItem(LS_SUPABASE_AUTOSYNC, "true");
      return true;
    }
    return val === "true" || val === "1";
  } catch {
    return true;
  }
}

export function setAutoSyncPreference(enabled: boolean): void {
  try {
    localStorage.setItem(LS_SUPABASE_AUTOSYNC, enabled ? "true" : "false");
  } catch {}
}

export function subscribeToSyncEvents(onSync: () => void): () => void {
  if (typeof EventSource === "undefined") {
    return () => {};
  }

  const source = new EventSource("/api/sync/events");
  source.addEventListener("sync", () => {
    onSync();
  });

  source.onerror = () => {
    // Keep the connection alive; the polling fallback still handles updates.
  };

  return () => {
    source.close();
  };
}

/**
 * Checks connection status against the secure backend proxy.
 * No API keys or tokens are exposed to or handled by the frontend.
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  tablesFound: string[];
}> {
  try {
    const res = await fetch("/api/sync/status");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || `Server responded with status ${res.status}`,
        tablesFound: [],
      };
    }
    const data = await res.json();
    return {
      success: data.success && data.connected,
      message: data.message || "Connected to Supabase database",
      tablesFound: data.tablesFound || [],
    };
  } catch (e: any) {
    return {
      success: false,
      message: e.message || "Failed to contact sync service",
      tablesFound: [],
    };
  }
}

/**
 * Uploads a bill document to Supabase Storage via the secure backend proxy.
 * Returns a publicly accessible URL that can be stored in the bill row.
 */
export async function uploadBillAttachment(file: File, folder = "bills"): Promise<{
  url: string;
  path: string;
  name: string;
  type: string;
}> {
  const reader = new FileReader();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file for upload"));
    reader.readAsDataURL(file);
  });

  const response = await fetch("/api/storage/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      folder,
      dataUrl,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Attachment upload failed with status ${response.status}`);
  }

  return {
    url: payload.url,
    path: payload.path,
    name: payload.name || file.name,
    type: payload.type || file.type || "application/octet-stream",
  };
}

/**
 * Pushes entire application state securely to Supabase via server-side API proxy.
 * Secret keys remain safely isolated on the backend.
 */
export async function supabasePushAll(state: AppState): Promise<{ success: boolean; message: string }> {
  console.log("📤 Pushing state to /api/sync/push...", {
    billCount: state.bills?.length || 0,
    categoryCount: state.categories?.length || 0,
    accountCount: state.accounts?.length || 0,
  });
  
  const response = await fetch("/api/sync/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errorMsg = err.error || `Server sync failed with status ${response.status}`;
    console.error("❌ Push failed:", errorMsg);
    throw new Error(errorMsg);
  }

  const result = await response.json();
  console.log("✅ Push succeeded:", result.message);
  return {
    success: true,
    message: result.message || "All financial records successfully synced to Supabase.",
  };
}

/**
 * Pulls application state securely from Supabase via server-side API proxy.
 */
export async function supabasePullAll(): Promise<Partial<AppState>> {
  const response = await fetch("/api/sync/pull");

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server pull failed with status ${response.status}`);
  }

  const result = await response.json();
  return result.data || {};
}

/**
 * SQL Schema definition for Supabase PostgreSQL database tables.
 */
export function generateSqlSetupScript(): string {
  return `-- ========================================================
-- Supabase Schema for Ledger — Household Finance
-- Run this in your Supabase SQL Editor (SQL tab in dashboard)
-- ========================================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7B6EF6',
  description TEXT DEFAULT '',
  featured BOOLEAN DEFAULT false,
  logo TEXT,
  sort_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  due TEXT DEFAULT '—',
  month TEXT DEFAULT 'Aug',
  year INTEGER DEFAULT 2026,
  timing TEXT DEFAULT 'upcoming',
  photo JSONB,
  logo TEXT,
  payment_plan BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  paid_by TEXT,
  escalation TEXT,
  iban TEXT,
  reference TEXT,
  payments JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  tag TEXT,
  bank_feed_url TEXT,
  has_groceries BOOLEAN DEFAULT false,
  transactions JSONB DEFAULT '[]'::jsonb,
  goals JSONB DEFAULT '[]'::jsonb,
  bills JSONB DEFAULT '[]'::jsonb,
  budgets JSONB DEFAULT '[]'::jsonb,
  loans JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Groceries Table
CREATE TABLE IF NOT EXISTS public.groceries (
  id BIGINT PRIMARY KEY,
  budget NUMERIC(10, 2) DEFAULT 400.00,
  entries JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BIGINT PRIMARY KEY,
  verse JSONB,
  subscriptions JSONB,
  currency JSONB,
  language TEXT DEFAULT 'en',
  login_notes JSONB DEFAULT '[]'::jsonb,
  monthly_budget_cap NUMERIC(10, 2) DEFAULT 2500.00,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Login details
CREATE TABLE IF NOT EXISTS public.login_notes (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  username TEXT DEFAULT '',
  password TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  url TEXT DEFAULT '',
  photo TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.login_notes
  ADD COLUMN IF NOT EXISTS photo TEXT;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS login_notes JSONB DEFAULT '[]'::jsonb;

-- Enable Row Level Security (RLS) with NO public policies.
-- The app never talks to Supabase from the browser — every read/write goes
-- through the /api/sync/* endpoints on the server, which authenticate using
-- SUPABASE_SERVICE_ROLE_KEY. The service role key bypasses RLS entirely, so
-- the server keeps working normally, while RLS with zero policies means the
-- anon/publishable key (which is fine to have public) grants NO access at
-- all to these tables. Do not add a "USING (true)" policy here — that is
-- what would make this data readable/writable by anyone with the anon key.
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groceries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_notes ENABLE ROW LEVEL SECURITY;

`;
}
