import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Lazy-initialized Server-Side Supabase Client (Secret keys never sent to browser)
let serverSupabaseClient: SupabaseClient | null = null;
const syncSubscribers = new Set<express.Response>();

function broadcastSyncEvent() {
  const payload = `event: sync\ndata: ${JSON.stringify({ type: "sync", at: new Date().toISOString() })}\n\n`;

  for (const res of syncSubscribers) {
    try {
      res.write(payload);
    } catch {
      syncSubscribers.delete(res);
    }
  }
}

function isValidHttpUrl(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeLegacyLabel(value?: string | null): string | null {
  if (value == null) return null;
  const trim = value.trim();
  if (!trim) return null;
  if (trim === "Gemeente Amsterdam") return "Gemeente";
  if (trim === "Gemeente Amsterdam — municipal tax") return "Gemeente";
  return trim;
}

function normalizeOutgoingStateForSync(state: any) {
  const normalized = { ...state };

  if (Array.isArray(normalized.categories)) {
    normalized.categories = normalized.categories.map((c: any) => ({
      ...c,
      name: normalizeLegacyLabel(c?.name) || c?.name || "Untitled",
    }));
  }

  if (Array.isArray(normalized.bills)) {
    normalized.bills = normalized.bills.map((b: any) => ({
      ...b,
      name: normalizeLegacyLabel(b?.name) || b?.name || "Untitled Bill",
    }));
  }

  return normalized;
}

function getServerSupabase(): SupabaseClient | null {
  if (serverSupabaseClient) return serverSupabaseClient;

  const rawUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();

  const rawKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!rawUrl || !rawKey || !isValidHttpUrl(rawUrl)) {
    return null;
  }

  try {
    serverSupabaseClient = createClient(rawUrl, rawKey, {
      auth: { persistSession: false },
    });
    return serverSupabaseClient;
  } catch (err) {
    console.warn("Supabase client could not be initialized:", (err as any)?.message || err);
    return null;
  }
}

export async function createApiApp(): Promise<express.Express> {
  const app = express();

  app.use(express.json({ limit: "25mb" }));

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Upload a bill attachment to Supabase Storage and return a stable URL.
  app.post("/api/storage/upload", async (req, res) => {
    try {
      const { dataUrl, fileName, mimeType, folder } = req.body || {};
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ success: false, error: "No file payload provided." });
      }
      if (!fileName || typeof fileName !== "string") {
        return res.status(400).json({ success: false, error: "No file name provided." });
      }

      const supabase = getServerSupabase();
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase server connection is not configured for storage uploads.",
        });
      }

      const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const cleanFolder = typeof folder === "string" && /^[a-zA-Z0-9_-]+$/.test(folder) ? folder : "bills";
      const safePath = `${cleanFolder}/${Date.now()}-${cleanName}`;
      const buffer = Buffer.from(base64Data, "base64");

      const { error: uploadError } = await supabase.storage
        .from("app-file")
        .upload(safePath, buffer, {
          contentType: mimeType || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.warn("Storage upload failed:", uploadError.message);
        return res.status(500).json({
          success: false,
          error: uploadError.message || "Failed to upload attachment to Supabase Storage.",
        });
      }

      const { data: publicUrlData } = supabase.storage.from("app-file").getPublicUrl(safePath);
      if (!publicUrlData?.publicUrl) {
        return res.status(500).json({ success: false, error: "Failed to generate public URL for uploaded attachment." });
      }

      return res.json({
        success: true,
        url: publicUrlData.publicUrl,
        path: safePath,
        name: fileName,
        type: mimeType || "application/octet-stream",
      });
    } catch (err: any) {
      console.error("Storage upload error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to upload attachment to storage.",
      });
    }
  });

  // Server-Sent Events stream for immediate cross-device update notifications.
  app.get("/api/sync/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    syncSubscribers.add(res);

    req.on("close", () => {
      syncSubscribers.delete(res);
    });
  });

  // Supabase Server-Side Sync Status (Returns status WITHOUT leaking API keys or secrets)
  app.get("/api/sync/status", async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (!supabase) {
        return res.json({
          success: false,
          connected: false,
          message: "Supabase server connection not configured.",
          tablesFound: [],
        });
      }

      const tablesFound: string[] = [];

      // Check bills table
      const { error: billsErr } = await supabase.from("bills").select("id").limit(1);
      if (!billsErr) tablesFound.push("bills");

      // Check categories table
      const { error: catsErr } = await supabase.from("categories").select("id").limit(1);
      if (!catsErr) tablesFound.push("categories");

      // Check accounts table
      const { error: accErr } = await supabase.from("accounts").select("id").limit(1);
      if (!accErr) tablesFound.push("accounts");

      // Check groceries table
      const { error: grocErr } = await supabase.from("groceries").select("id").limit(1);
      if (!grocErr) tablesFound.push("groceries");

      // Check app_settings table
      const { error: setErr } = await supabase.from("app_settings").select("id").limit(1);
      if (!setErr) tablesFound.push("app_settings");

      return res.json({
        success: true,
        connected: true,
        message:
          tablesFound.length > 0
            ? `Connected to Supabase PostgreSQL database (${tablesFound.length} tables active)`
            : "Connected to Supabase. Database tables ready for creation.",
        tablesFound,
      });
    } catch (err: any) {
      return res.json({
        success: false,
        connected: false,
        message: err?.message || "Failed to reach Supabase backend",
        tablesFound: [],
      });
    }
  });

  // Supabase Server-Side Push (Securely saves state to Supabase without frontend keys)
  app.post("/api/sync/push", async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase server connection is not initialized.",
        });
      }

      const { state } = req.body;
      if (!state) {
        return res.status(400).json({ success: false, error: "No state data provided." });
      }

      console.log("📤 Incoming push from client, syncing to database...");

      const normalizedState = normalizeOutgoingStateForSync(state);
      const results: string[] = [];

      // 1. Categories
      if (Array.isArray(normalizedState.categories) && normalizedState.categories.length > 0) {
        const catRows = normalizedState.categories.map((c: any) => ({
          id: String(c.id),
          name: normalizeLegacyLabel(c.name) || c.name || "Untitled",
          color: c.color || "#7B6EF6",
          description: c.description || "",
          featured: !!c.featured,
          logo: c.logo || null,
          sort_order: c.sortOrder ?? 0,
          updated_at: new Date().toISOString(),
        }));
        const { error: catErr } = await supabase.from("categories").upsert(catRows, { onConflict: "id" });
        if (catErr) {
          console.warn("Categories sync warning:", catErr.message);
        } else {
          results.push(`Categories (${catRows.length})`);
        }
      }

      // 2. Bills
      if (Array.isArray(normalizedState.bills) && normalizedState.bills.length > 0) {
        const billRows = normalizedState.bills.map((b: any) => {
          let photoToStore = null;
          if (b.photo) {
            try {
              if (typeof b.photo === "string") {
                const trimmed = b.photo.trim();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                  photoToStore = JSON.parse(trimmed);
                } else {
                  photoToStore = trimmed;
                }
              } else {
                photoToStore = b.photo;
              }

              const photoPayload = typeof photoToStore === "string" ? photoToStore : JSON.stringify(photoToStore ?? {});
              if (photoPayload.length > 5242880) {
                console.warn(`⚠️  Bill ${b.id} photo is ${(photoPayload.length / 1024 / 1024).toFixed(1)}MB - may cause sync issues`);
              } else {
                console.log(`📄 Bill ${b.id} photo: ${(photoPayload.length / 1024).toFixed(1)}KB`);
              }
            } catch (e) {
              console.warn(`Failed to serialize photo for bill ${b.id}:`, e);
              photoToStore = null;
            }
          }

          return {
            id: Number(b.id),
            name: normalizeLegacyLabel(b.name) || b.name || "Untitled Bill",
            category: b.category || "housing",
            amount: parseFloat(b.amount) || 0,
            paid_amount: parseFloat(b.paidAmount ?? 0),
            due: b.due || "—",
            month: b.month || "Aug",
            year: parseInt(b.year, 10) || 2026,
            timing: b.timing || "upcoming",
            photo: photoToStore,
            logo: b.logo || null,
            payment_plan: !!b.paymentPlan,
            notes: b.notes || "",
            paid_by: b.paidBy || null,
            escalation: b.escalation || null,
            iban: b.iban || null,
            reference: b.reference || null,
            payments: b.payments || [],
            sort_order: b.sortOrder ?? 0,
            updated_at: new Date().toISOString(),
          };
        });
        const { error: billErr } = await supabase.from("bills").upsert(billRows, { onConflict: "id" });
        if (billErr) {
          console.warn("Bills sync warning:", billErr.message);
        } else {
          results.push(`Bills (${billRows.length})`);
        }
      }

      // 3. Accounts
      if (Array.isArray(normalizedState.accounts) && normalizedState.accounts.length > 0) {
        const accRows = normalizedState.accounts.map((a: any) => ({
          id: String(a.id),
          label: a.label || a.id,
          tag: a.tag || null,
          bank_feed_url: a.bankFeedUrl || null,
          has_groceries: !!a.hasGroceries,
          transactions: Array.isArray(a.transactions) ? a.transactions : [],
          goals: Array.isArray(a.goals) ? a.goals : [],
          bills: Array.isArray(a.bills) ? a.bills : [],
          budgets: Array.isArray(a.budgets) ? a.budgets : [],
          loans: Array.isArray(a.loans) ? a.loans : [],
          updated_at: new Date().toISOString(),
        }));
        const { error: accErr } = await supabase.from("accounts").upsert(accRows, { onConflict: "id" });
        if (accErr) {
          console.warn("Accounts sync warning:", accErr.message);
        } else {
          results.push(`Accounts (${accRows.length})`);
        }
      }

      // 4. Groceries
      if (normalizedState.groceries) {
        try {
          const { error: grocErr } = await supabase.from("groceries").upsert(
            {
              id: 1,
              budget: normalizedState.groceries.budget || 400,
              entries: normalizedState.groceries.entries || [],
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
          if (grocErr) {
            throw grocErr;
          }
          results.push("Groceries");
        } catch (grocEx: any) {
          console.warn("Groceries sync warning:", grocEx?.message);
          return res.status(500).json({
            success: false,
            error: `Groceries sync failed: ${grocEx?.message || "database write failed"}`,
          });
        }
      }

      // 5. App Settings
      try {
        const { error: settingsError } = await supabase.from("app_settings").upsert(
          {
            id: 1,
            verse: normalizedState.verse || null,
            subscriptions: normalizedState.subscriptions || [],
            currency: normalizedState.currency || { code: "EUR", symbol: "€" },
            language: normalizedState.language || "en",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (settingsError) {
          throw settingsError;
        }
        results.push("Settings");
      } catch (setEx: any) {
        console.warn("Settings sync warning:", setEx?.message);
        return res.status(500).json({
          success: false,
          error: `Settings sync failed: ${setEx?.message || "database write failed"}`,
        });
      }

      // 6. Login details
      try {
        const loginNotes = Array.isArray(normalizedState.loginNotes) ? normalizedState.loginNotes : [];
        const existingNotesQuery = supabase.from("login_notes").delete();
        const { error: staleNotesError } = loginNotes.length > 0
          ? await existingNotesQuery.not("id", "in", `(${loginNotes.map((note: any) => Number(note.id)).join(",")})`)
          : await existingNotesQuery.gte("id", 0);
        if (staleNotesError) throw staleNotesError;
        const { error: loginNotesError } = await supabase.from("login_notes").upsert(
          loginNotes.map((note: any) => ({
            id: Number(note.id),
            title: note.title || "Untitled login",
            username: note.username || "",
            password: note.password || "",
            notes: note.notes || "",
            url: note.url || "",
            photo: note.photo || null,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "id" }
        );
        if (loginNotesError) throw loginNotesError;
        results.push("Login details");
      } catch (loginNotesEx: any) {
        console.warn("Login details sync warning:", loginNotesEx?.message);
        return res.status(500).json({
          success: false,
          error: `Login details sync failed: ${loginNotesEx?.message || "database write failed"}`,
        });
      }

      console.log(`✅ Sync complete. Broadcasting to ${syncSubscribers.size} connected device(s): ${results.join(", ")}`);
      broadcastSyncEvent();

      return res.json({
        success: true,
        message: `Synced to Supabase: ${results.join(", ")}`,
        pushedCount: results.length,
      });
    } catch (err: any) {
      console.error("Supabase push error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to push state to Supabase database.",
      });
    }
  });

  // Supabase Server-Side Pull (Securely retrieves state from Supabase without exposing keys)
  app.get("/api/sync/pull", async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase server connection is not initialized.",
        });
      }

      console.log("📥 Pull request from client, fetching latest state from database...");

      const updates: any = {};

      // 1. Categories
      try {
        const { data: catData, error: catErr } = await supabase
          .from("categories")
          .select("*")
          .order("sort_order", { ascending: true });
        if (!catErr && catData && catData.length > 0) {
          updates.categories = catData.map((row: any) => ({
            id: String(row.id),
            name: normalizeLegacyLabel(row.name) || row.name || "Untitled",
            color: row.color || "#7B6EF6",
            description: row.description || "",
            featured: !!row.featured,
            logo: row.logo || null,
            sortOrder: row.sort_order ?? row.sortOrder ?? 0,
          }));
        }
      } catch (e: any) {
        console.warn("Pull categories warning:", e?.message);
      }

      // 2. Bills
      try {
        const { data: billData, error: billErr } = await supabase
          .from("bills")
          .select("*")
          .order("sort_order", { ascending: true });
        if (!billErr && billData && billData.length > 0) {
          updates.bills = billData.map((row: any) => {
            let photo = null;
            if (row.photo) {
              try {
                if (typeof row.photo === "string") {
                  const trimmed = row.photo.trim();
                  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    const parsed = JSON.parse(trimmed);
                    photo = parsed && typeof parsed === "object" ? parsed : null;
                  } else if (trimmed.startsWith("data:")) {
                    photo = {
                      type: "application/pdf",
                      name: "document.pdf",
                      data: trimmed,
                    };
                  }
                } else if (row.photo && typeof row.photo === "object") {
                  photo = row.photo;
                }
              } catch {
                if (typeof row.photo === "string" && row.photo.startsWith("data:")) {
                  photo = {
                    type: "application/pdf",
                    name: "document.pdf",
                    data: row.photo,
                  };
                }
              }
            }
            let payments = [];
            if (row.payments) {
              try {
                payments = typeof row.payments === "string" ? JSON.parse(row.payments) : row.payments;
              } catch {
                payments = [];
              }
            }
            return {
              id: Number(row.id),
              name: normalizeLegacyLabel(row.name) || row.name || "Untitled Bill",
              category: row.category || "housing",
              amount: parseFloat(row.amount) || 0,
              paidAmount: parseFloat(row.paid_amount ?? row.paidAmount ?? 0),
              due: row.due || "—",
              month: row.month || "Aug",
              year: parseInt(row.year, 10) || 2026,
              timing: row.timing === "overdue" ? "overdue" : "upcoming",
              photo,
              logo: row.logo || null,
              paymentPlan: !!(row.payment_plan ?? row.paymentPlan),
              notes: row.notes || "",
              paidBy: row.paid_by ?? row.paidBy ?? null,
              escalation: row.escalation || null,
              iban: row.iban || null,
              reference: row.reference || null,
              payments,
              sortOrder: row.sort_order ?? row.sortOrder ?? 0,
            };
          });
        }
      } catch (e: any) {
        console.warn("Pull bills warning:", e?.message);
      }

      // 3. Accounts
      try {
        const { data: accData, error: accErr } = await supabase.from("accounts").select("*");
        if (!accErr && accData && accData.length > 0) {
          updates.accounts = accData.map((row: any) => ({
            id: String(row.id),
            label: row.label || row.id,
            tag: row.tag || null,
            bankFeedUrl: row.bank_feed_url ?? row.bankFeedUrl ?? null,
            hasGroceries: !!(row.has_groceries ?? row.hasGroceries),
            transactions: Array.isArray(row.transactions) ? row.transactions : [],
            goals: Array.isArray(row.goals) ? row.goals : [],
            bills: Array.isArray(row.bills) ? row.bills : [],
            budgets: Array.isArray(row.budgets) ? row.budgets : [],
            loans: Array.isArray(row.loans) ? row.loans : [],
          }));
        }
      } catch (e: any) {
        console.warn("Pull accounts warning:", e?.message);
      }

      // 4. Groceries
      try {
        const { data: grocData, error: grocErr } = await supabase.from("groceries").select("*").limit(1);
        if (!grocErr && grocData && grocData[0]) {
          updates.groceries = {
            budget: parseFloat(grocData[0].budget) || 400,
            entries: Array.isArray(grocData[0].entries) ? grocData[0].entries : [],
          };
        }
      } catch (e: any) {
        console.warn("Pull groceries warning:", e?.message);
      }

      // 5. Settings
      try {
        const { data: setData, error: setErr } = await supabase.from("app_settings").select("*").limit(1);
        if (!setErr && setData && setData[0]) {
          if (setData[0].verse) updates.verse = setData[0].verse;
          if (setData[0].subscriptions) updates.subscriptions = setData[0].subscriptions;
          if (setData[0].currency) updates.currency = setData[0].currency;
          if (setData[0].language) updates.language = setData[0].language;
          if (setData[0].monthly_budget_cap !== undefined && setData[0].monthly_budget_cap !== null) {
            updates.monthlyBudgetCap = parseFloat(setData[0].monthly_budget_cap);
          }
        }
      } catch (e: any) {
        console.warn("Pull settings warning:", e?.message);
      }

      // 6. Login details
      try {
        const { data: loginNotesData, error: loginNotesErr } = await supabase
          .from("login_notes")
          .select("*")
          .order("updated_at", { ascending: false });
        if (!loginNotesErr && loginNotesData) {
          updates.loginNotes = loginNotesData.map((row: any) => ({
            id: Number(row.id),
            title: row.title || "Untitled login",
            username: row.username || "",
            password: row.password || "",
            notes: row.notes || "",
            url: row.url || "",
            photo: row.photo || null,
          }));
        }
      } catch (e: any) {
        console.warn("Pull login details warning:", e?.message);
      }

      return res.json({
        success: true,
        data: updates,
      });
    } catch (err: any) {
      console.error("Supabase pull error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to pull state from Supabase database.",
      });
    }
  });

  // Calendar Sync Feed Endpoint (Subscribable / WebCal iCal URL for Google Calendar & Apple Calendar)
  // Supports POST with bills state or GET with sample / sync
  app.get("/api/calendar/feed.ics", (req, res) => {
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="household_bills_schedule.ics"');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    const sampleIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ledger Household App//Calendar Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Household Bills & Due Dates",
      "X-WR-TIMEZONE:UTC",
      "X-WR-CALDESC:Live Bill Schedule & Payment Alarms from Ledger App",
      "BEGIN:VEVENT",
      `UID:ledger-welcome-${Date.now()}@ledger.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
      "SUMMARY:🔔 Ledger Calendar Feed Connected",
      "DESCRIPTION:Your live household bill schedule is linked. Active bills and payment due dates will appear here with alarms.",
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:Household bill due tomorrow",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    res.send(sampleIcs);
  });

  // Export custom bills feed with alarms
  app.post("/api/calendar/export-feed", (req, res) => {
    try {
      const { bills = [], currencySymbol = "€", recipients = [] } = req.body;
      
      const events = bills.map((b: any, index: number) => {
        const amount = b.amount || 0;
        const paidAmount = b.paidAmount || 0;
        const rem = Math.max(0, amount - paidAmount);
        const year = b.year || 2026;
        const dueStr = b.due || "25th";
        const dayMatch = dueStr.match(/\d+/);
        const day = dayMatch ? String(dayMatch[0]).padStart(2, "0") : "15";
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIdx = monthNames.findIndex((m) => m.toLowerCase() === (b.month || "Aug").toLowerCase().slice(0, 3));
        const mNum = String((monthIdx >= 0 ? monthIdx : 7) + 1).padStart(2, "0");
        const dateClean = `${year}${mNum}${day}`;
        const uid = `bill-${b.id || index}-${year}-${mNum}@ledger.app`;
        const dtstamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

        let desc = `Household Bill: ${b.name}\\n`;
        desc += `Amount Due: ${currencySymbol}${rem.toFixed(2)}\\n`;
        desc += `Due Date: ${dueStr} ${year}\\n`;
        if (b.iban) desc += `IBAN: ${b.iban}\\n`;
        if (b.reference) desc += `Reference: ${b.reference}\\n`;
        if (b.notes) desc += `Notes: ${String(b.notes).replace(/\n/g, " ")}\\n`;
        desc += `Status: ${paidAmount >= amount ? "Paid" : paidAmount > 0 ? "Partially Paid" : "Unpaid"}\\n`;

        return [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;VALUE=DATE:${dateClean}`,
          `DTEND;VALUE=DATE:${dateClean}`,
          `SUMMARY:💸 Bill: ${b.name} (${currencySymbol}${rem.toFixed(2)})`,
          `DESCRIPTION:${desc}`,
          b.iban ? `LOCATION:IBAN ${b.iban}` : "LOCATION:Online Banking",
          "STATUS:CONFIRMED",
          "BEGIN:VALARM",
          "TRIGGER:-P1D",
          "ACTION:DISPLAY",
          `DESCRIPTION:Reminder: ${b.name} is due tomorrow!`,
          "END:VALARM",
          "BEGIN:VALARM",
          "TRIGGER:-P3D",
          "ACTION:DISPLAY",
          `DESCRIPTION:Upcoming: ${b.name} is due in 3 days.`,
          "END:VALARM",
          "END:VEVENT",
        ].join("\r\n");
      }).join("\r\n");

      const feedIcs = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Ledger Household App//Calendar Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Household Bills & Due Dates",
        "X-WR-TIMEZONE:UTC",
        events,
        "END:VCALENDAR",
      ].join("\r\n");

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="household_bills_schedule.ics"');
      return res.send(feedIcs);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to build calendar" });
    }
  });

  // AI Bill Document & Image Extraction Endpoint (Multimodal Gemini Vision)
  app.post("/api/gemini/extract-bill", async (req, res) => {
    try {
      const { image, mimeType = "image/jpeg", categories = [], currencySymbol = "€" } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!image) {
        return res.status(400).json({
          success: false,
          error: "No image data provided for bill extraction.",
        });
      }

      // Clean base64 string
      let rawBase64 = image;
      let detectedMime = mimeType;
      if (typeof image === "string" && image.includes(";base64,")) {
        const parts = image.split(";base64,");
        detectedMime = parts[0].replace("data:", "") || mimeType;
        rawBase64 = parts[1];
      }

      // Check if API key is present
      if (!apiKey) {
        return res.json({
          success: true,
          source: "offline-helper",
          data: {
            isBill: true,
            readability: "partially_readable",
            confidenceScore: 65,
            needsRetake: false,
            statusMessage: "Document captured. Please review and fill in any missing details below.",
            userActionPrompt: "Gemini API key not configured yet. We have primed the form for you—please verify the bill name and amount.",
            missingFields: ["amount", "dueDateIso"],
            extractedData: {
              name: "Scanned Invoice",
              category: categories[0]?.id || "housing",
              amount: null,
              dueDateIso: new Date().toISOString().slice(0, 10),
              iban: "",
              reference: "",
              escalation: null,
              notes: "Scanned invoice receipt",
            },
          },
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `You are an expert AI invoice, receipt, and utility bill scanner for household budgeting.
Analyze the provided document/photo.

Available categories in app: ${JSON.stringify(categories.map((c: any) => ({ id: c.id, name: c.name })))}
Currency: ${currencySymbol}

Tasks:
1. Examine if this image is a bill, receipt, fine, tax notice, utility invoice, subscription statement, or payment demand.
2. Evaluate visual readability: "clear", "blurry", "partially_readable", or "unreadable" (e.g. if it's too dark, cropped, or not a document).
3. Extract the following fields:
   - name: Company / Provider / Creditor name (e.g., "Ziggo", "Vattenfall", "Belastingdienst", "KPN", "Waternet", "Albert Heijn", "Gym").
   - category: Match to one of the provided category IDs or a close logical fit (e.g. "housing", "utilities", "telecom", "insurance", "taxes", "subscriptions", "groceries").
   - amount: The total due or total payment amount as a positive number (e.g., 64.95). Exclude currency symbols.
   - dueDateIso: The payment deadline / due date formatted as YYYY-MM-DD (e.g. "2026-08-28"). If only day/month are visible, infer 2026. If no due date, leave null or empty.
   - iban: The IBAN bank account number to pay to, if present.
   - reference: Payment reference, invoice number, or structured communication (betalingskenmerk).
   - escalation: "reminder" (herinnering), "aanmaning" (final notice), "deurwaarder" (bailiff/collection), or null if regular invoice.
   - notes: A concise 1-sentence description of the service/items.
4. Quality & Readability Verification:
   - If the image is NOT a bill or receipt (e.g. selfie, scenery, meme, unrelated item), set isBill: false, readability: "unreadable", needsRetake: true, and explain in userActionPrompt.
   - If the image is blurry, poorly cropped, cut off, or essential numbers (like total amount) are unreadable, set readability: "blurry" or "partially_readable", list the missing fields in missingFields (e.g. ["amount", "dueDateIso"]), and write a friendly message in userActionPrompt asking the user to either retake the photo in better light or fill in the missing fields.
   - If the bill is clear and all key details were parsed, set isBill: true, readability: "clear", needsRetake: false, confidenceScore: 90-100, and empty missingFields.

Return the result as JSON adhering to the specified schema.`;

      const imagePart = {
        inlineData: {
          mimeType: detectedMime.startsWith("image/") || detectedMime === "application/pdf" ? detectedMime : "image/jpeg",
          data: rawBase64,
        },
      };

      const textPart = {
        text: prompt,
      };

      const modelsToTry = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];
      let parsedExtraction: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [imagePart, textPart] },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isBill: { type: Type.BOOLEAN },
                  readability: { type: Type.STRING },
                  confidenceScore: { type: Type.NUMBER },
                  needsRetake: { type: Type.BOOLEAN },
                  statusMessage: { type: Type.STRING },
                  userActionPrompt: { type: Type.STRING },
                  missingFields: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  extractedData: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      category: { type: Type.STRING },
                      amount: { type: Type.NUMBER },
                      dueDateIso: { type: Type.STRING },
                      iban: { type: Type.STRING },
                      reference: { type: Type.STRING },
                      escalation: { type: Type.STRING },
                      notes: { type: Type.STRING },
                    },
                  },
                },
                required: [
                  "isBill",
                  "readability",
                  "confidenceScore",
                  "needsRetake",
                  "statusMessage",
                  "missingFields",
                  "extractedData",
                ],
              },
            },
          });

          const resText = response.text || "{}";
          parsedExtraction = JSON.parse(resText);
          if (parsedExtraction && typeof parsedExtraction.isBill === "boolean") {
            return res.json({
              success: true,
              source: "gemini-vision",
              modelUsed: modelName,
              data: parsedExtraction,
            });
          }
        } catch (modelErr: any) {
          console.warn(`Extraction model ${modelName} error:`, modelErr?.message || modelErr);
        }
      }

      // Fallback if AI models were busy
      return res.json({
        success: true,
        source: "fallback-scanner",
        data: {
          isBill: true,
          readability: "partially_readable",
          confidenceScore: 70,
          needsRetake: false,
          statusMessage: "Document photo attached. Please verify the amount and due date below.",
          userActionPrompt: "Photo attached! Please confirm the bill name and due date.",
          missingFields: ["amount"],
          extractedData: {
            name: "Uploaded Invoice",
            category: categories[0]?.id || "housing",
            amount: null,
            dueDateIso: new Date().toISOString().slice(0, 10),
            iban: "",
            reference: "",
            escalation: null,
            notes: "",
          },
        },
      });
    } catch (error: any) {
      console.error("Bill extraction endpoint failure:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to extract information from document.",
      });
    }
  });

  // AI Monthly Financial Feedback Endpoint
  app.post("/api/gemini/monthly-feedback", async (req, res) => {
    try {
      const { month, year, bills, groceries, accounts, currencySymbol } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      const symbol = currencySymbol || "€";
      const monthName = month || "current";
      const yearNum = year || 2026;

      // Check if API key is provided
      if (!apiKey) {
        // Return intelligent algorithmic breakdown if key is not yet set
        return res.json({
          success: true,
          source: "local-engine",
          data: generateAlgorithmicFeedback({ month: monthName, year: yearNum, bills, groceries, accounts, symbol }),
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `You are an expert personal financial advisor and household budget analyst.
Analyze the following financial records for ${monthName} ${yearNum} and provide clear, encouraging, highly actionable feedback on what the user did well, where they can save money, and specific steps to improve their financial health.

Currency symbol: ${symbol}

Data Overview:
1. Bills & Obligations:
${JSON.stringify(bills || [], null, 2)}

2. Grocery Spending & Budget:
Budget: ${groceries?.budget ? `${symbol}${groceries.budget}` : "Not set"}
Entries for this period:
${JSON.stringify(groceries?.entries || [], null, 2)}

3. Accounts, Balances, Savings Goals & Loans:
${JSON.stringify(accounts || [], null, 2)}

Please provide a comprehensive yet concise JSON response with:
- overallScore (number between 0-100 indicating financial health this month)
- monthTitle (string, e.g. "${monthName} ${yearNum} Financial Review")
- executiveSummary (2-3 sentences highlighting overall standing and primary focus)
- keyHighlights (array of 3-4 strings celebrating wins or major observations)
- groceryInsights (object with: spentAmount (number), budgetStatus (string: 'under', 'on-track', 'over', or 'no-budget'), observation (string), shoppingPacingTips (array of 2-3 strings))
- billsOptimization (object with: totalDue (number), totalPaid (number), overdueRiskNote (string), recommendations (array of 2-4 strings focusing on late fees, payment plans, or recurring subscription reductions))
- savingsAndGoals (object with: statusNote (string), recommendations (array of 2-3 strings for building emergency fund or managing debt))
- actionPlan (array of 3-5 objects each with: title (string), description (string), priority ('high' | 'medium' | 'low'), impact (string, e.g. "Save ~€45/mo" or "Avoid late penalties"))
`;

      let parsedData: any = null;
      const modelsToTry = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  overallScore: { type: Type.NUMBER },
                  monthTitle: { type: Type.STRING },
                  executiveSummary: { type: Type.STRING },
                  keyHighlights: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  groceryInsights: {
                    type: Type.OBJECT,
                    properties: {
                      spentAmount: { type: Type.NUMBER },
                      budgetStatus: { type: Type.STRING },
                      observation: { type: Type.STRING },
                      shoppingPacingTips: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ["spentAmount", "budgetStatus", "observation", "shoppingPacingTips"],
                  },
                  billsOptimization: {
                    type: Type.OBJECT,
                    properties: {
                      totalDue: { type: Type.NUMBER },
                      totalPaid: { type: Type.NUMBER },
                      overdueRiskNote: { type: Type.STRING },
                      recommendations: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ["totalDue", "totalPaid", "overdueRiskNote", "recommendations"],
                  },
                  savingsAndGoals: {
                    type: Type.OBJECT,
                    properties: {
                      statusNote: { type: Type.STRING },
                      recommendations: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ["statusNote", "recommendations"],
                  },
                  actionPlan: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        priority: { type: Type.STRING },
                        impact: { type: Type.STRING },
                      },
                      required: ["title", "description", "priority", "impact"],
                    },
                  },
                },
                required: [
                  "overallScore",
                  "monthTitle",
                  "executiveSummary",
                  "keyHighlights",
                  "groceryInsights",
                  "billsOptimization",
                  "savingsAndGoals",
                  "actionPlan",
                ],
              },
            },
          });

          const responseText = response.text || "{}";
          parsedData = JSON.parse(responseText);
          if (parsedData && parsedData.overallScore !== undefined) {
            return res.json({
              success: true,
              source: "gemini-ai",
              modelUsed: modelName,
              data: parsedData,
            });
          }
        } catch (modelError: any) {
          console.warn(`Model ${modelName} temporary issue (${modelError?.status || modelError?.message || "unavailable"}), attempting next tier...`);
        }
      }

      // If both AI models were temporarily busy/unavailable, serve the local algorithmic engine seamlessly
      const fallback = generateAlgorithmicFeedback({
        month: monthName,
        year: yearNum,
        bills,
        groceries,
        accounts,
        symbol,
      });

      return res.json({
        success: true,
        source: "local-engine",
        fallbackNote: "Analysis prepared using automated personal metrics engine.",
        data: fallback,
      });
    } catch (error: any) {
      console.warn("Generating algorithmic feedback fallback:", error?.message || error);
      const { month, year, bills, groceries, accounts, currencySymbol } = req.body;
      const fallback = generateAlgorithmicFeedback({
        month: month || "current",
        year: year || 2026,
        bills,
        groceries,
        accounts,
        symbol: currencySymbol || "€",
      });
      return res.json({
        success: true,
        source: "local-engine",
        fallbackNote: "Analysis prepared using automated local metrics engine.",
        data: fallback,
      });
    }
  });

  return app;
}

// Smart algorithmic feedback engine fallback
function generateAlgorithmicFeedback(ctx: {
  month: string;
  year: number;
  bills: any[];
  groceries: any;
  accounts: any[];
  symbol: string;
}) {
  const { month, year, bills = [], groceries, accounts = [], symbol } = ctx;

  const monthBills = bills.filter((b) => !b.month || b.month === month);
  const totalBillsAmt = monthBills.reduce((s, b) => s + (b.amount || 0), 0);
  const totalBillsPaid = monthBills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const remainingBills = Math.max(0, totalBillsAmt - totalBillsPaid);
  const overdueBills = monthBills.filter(
    (b) => b.timing === "overdue" && (b.paidAmount || 0) < (b.amount || 0)
  );

  const groceryEntries = (groceries?.entries || []).filter(
    (e: any) => e.month === month && (!e.year || e.year === year)
  );
  const grocerySpent = groceryEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const groceryBudget = groceries?.budget || 0;

  // Grocery budget ratio
  let groceryRatio = groceryBudget > 0 ? grocerySpent / groceryBudget : 0.8;
  let groceryStatus = "on-track";
  if (groceryBudget > 0) {
    if (grocerySpent > groceryBudget) groceryStatus = "over";
    else if (grocerySpent > groceryBudget * 0.85) groceryStatus = "approaching";
    else groceryStatus = "under";
  }

  // Calculate score
  let score = 80;
  if (overdueBills.length > 0) score -= overdueBills.length * 12;
  if (groceryStatus === "over") score -= 15;
  else if (groceryStatus === "under") score += 8;
  if (remainingBills === 0 && totalBillsAmt > 0) score += 10;
  score = Math.max(25, Math.min(98, Math.round(score)));

  // Generate action items
  const actionPlan: any[] = [];

  if (overdueBills.length > 0) {
    actionPlan.push({
      title: `Prioritize ${overdueBills.length} Overdue Bill${overdueBills.length > 1 ? "s" : ""}`,
      description: `Settle ${overdueBills.map((b) => b.name).join(", ")} (${symbol}${overdueBills.reduce((s, b) => s + (b.amount - (b.paidAmount || 0)), 0).toFixed(2)}) immediately to avoid administrative reminder penalties.`,
      priority: "high",
      impact: "Avoid collection surcharges and protect credit standing",
    });
  }

  if (groceryBudget > 0 && grocerySpent > groceryBudget) {
    actionPlan.push({
      title: "Rebalance Grocery Outflow",
      description: `Grocery purchases (${symbol}${grocerySpent.toFixed(2)}) exceeded your target by ${symbol}${(grocerySpent - groceryBudget).toFixed(2)}. Consider batch meal planning and combining weekly store runs.`,
      priority: "medium",
      impact: `Potential monthly saving of ${symbol}${(grocerySpent - groceryBudget).toFixed(2)}`,
    });
  } else if (groceryBudget > 0) {
    actionPlan.push({
      title: "Maintain Grocery Discipline",
      description: `You have spent ${symbol}${grocerySpent.toFixed(2)} of your ${symbol}${groceryBudget.toFixed(2)} allowance (${Math.round((1 - grocerySpent / groceryBudget) * 100)}% remaining buffer).`,
      priority: "low",
      impact: "Preserves discretionary cash buffer",
    });
  }

  actionPlan.push({
    title: "Automate Emergency Buffer Transfers",
    description: "Schedule a recurring fixed transfer directly following salary deposit to build a resilient multi-month safety net.",
    priority: "medium",
    impact: "Builds peace of mind and long-term liquidity",
  });

  return {
    overallScore: score,
    monthTitle: `${month} ${year} Financial Review`,
    executiveSummary: `For ${month} ${year}, your overall financial health score is ${score}/100. ${
      overdueBills.length > 0
        ? `You have ${overdueBills.length} outstanding bill(s) requiring immediate settlement.`
        : "Your fixed bill settlements are progressing smoothly."
    } Grocery outflow is currently ${groceryStatus === "over" ? "above" : "within"} planned targets.`,
    keyHighlights: [
      `${symbol}${totalBillsPaid.toFixed(2)} settled in fixed obligations this month.`,
      `${groceryEntries.length} grocery shopping trips logged totaling ${symbol}${grocerySpent.toFixed(2)}.`,
      overdueBills.length === 0
        ? "Zero overdue billing escalations recorded."
        : `${overdueBills.length} bill(s) flagged for payment attention.`,
      `Active savings and account balances monitored across all ledgers.`,
    ],
    groceryInsights: {
      spentAmount: grocerySpent,
      budgetStatus: groceryStatus,
      observation:
        groceryBudget > 0
          ? `You have utilized ${(groceryRatio * 100).toFixed(0)}% of your ${symbol}${groceryBudget.toFixed(2)} grocery budget across ${groceryEntries.length} trips.`
          : `Total grocery expenditure stands at ${symbol}${grocerySpent.toFixed(2)}. Setting a monthly cap will help forecast savings.`,
      shoppingPacingTips: [
        "Consolidate trips to 1-2 times weekly to curb spontaneous impulse items.",
        "Check staple inventory before visiting discount supermarkets (e.g. Lidl) before specialty stores.",
        "Take advantage of supermarket loyalty bonus apps and bulk staples discounts.",
      ],
    },
    billsOptimization: {
      totalDue: totalBillsAmt,
      totalPaid: totalBillsPaid,
      overdueRiskNote:
        overdueBills.length > 0
          ? `Immediate attention required: ${overdueBills.map((b) => b.name).join(", ")}.`
          : "All active obligations are current with no late escalation notices.",
      recommendations: [
        "Audit recurring digital and physical subscriptions quarterly to eliminate unused services.",
        "Ensure payment plan schedules remain aligned with monthly incoming cash flow.",
        "Set up automated calendar reminders 3 days before critical due dates.",
      ],
    },
    savingsAndGoals: {
      statusNote: "Consistent micro-deposits compound significantly over quarterly cycles.",
      recommendations: [
        "Target maintaining 3 months of essential fixed costs in your liquid emergency account.",
        "Allocate any grocery budget surplus directly into your top priority savings goal at month-end.",
      ],
    },
    actionPlan,
  };
}
