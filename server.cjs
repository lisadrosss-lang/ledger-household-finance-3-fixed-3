var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_path = __toESM(require("path"), 1);
var import_express2 = __toESM(require("express"), 1);
var import_vite = require("vite");

// api-app.ts
var import_express = __toESM(require("express"), 1);
var import_genai = require("@google/genai");
var import_supabase_js = require("@supabase/supabase-js");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var serverSupabaseClient = null;
function isValidHttpUrl(str) {
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
function getServerSupabase() {
  if (serverSupabaseClient) return serverSupabaseClient;
  const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!rawUrl || !rawKey || !isValidHttpUrl(rawUrl)) {
    return null;
  }
  try {
    serverSupabaseClient = (0, import_supabase_js.createClient)(rawUrl, rawKey, {
      auth: { persistSession: false }
    });
    return serverSupabaseClient;
  } catch (err) {
    console.warn("Supabase client could not be initialized:", err?.message || err);
    return null;
  }
}
async function createApiApp() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "15mb" }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/sync/status", async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (!supabase) {
        return res.json({
          success: false,
          connected: false,
          message: "Supabase server connection not configured.",
          tablesFound: []
        });
      }
      const tablesFound = [];
      const { error: billsErr } = await supabase.from("bills").select("id").limit(1);
      if (!billsErr) tablesFound.push("bills");
      const { error: catsErr } = await supabase.from("categories").select("id").limit(1);
      if (!catsErr) tablesFound.push("categories");
      const { error: accErr } = await supabase.from("accounts").select("id").limit(1);
      if (!accErr) tablesFound.push("accounts");
      const { error: grocErr } = await supabase.from("groceries").select("id").limit(1);
      if (!grocErr) tablesFound.push("groceries");
      const { error: setErr } = await supabase.from("app_settings").select("id").limit(1);
      if (!setErr) tablesFound.push("app_settings");
      return res.json({
        success: true,
        connected: true,
        message: tablesFound.length > 0 ? `Connected to Supabase PostgreSQL database (${tablesFound.length} tables active)` : "Connected to Supabase. Database tables ready for creation.",
        tablesFound
      });
    } catch (err) {
      return res.json({
        success: false,
        connected: false,
        message: err?.message || "Failed to reach Supabase backend",
        tablesFound: []
      });
    }
  });
  app.post("/api/sync/push", async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase server connection is not initialized."
        });
      }
      const { state } = req.body;
      if (!state) {
        return res.status(400).json({ success: false, error: "No state data provided." });
      }
      const results = [];
      if (Array.isArray(state.categories) && state.categories.length > 0) {
        const catRows = state.categories.map((c) => ({
          id: String(c.id),
          name: c.name || "Untitled",
          color: c.color || "#7B6EF6",
          description: c.description || "",
          featured: !!c.featured,
          logo: c.logo || null,
          sort_order: c.sortOrder ?? 0,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }));
        const { error: catErr } = await supabase.from("categories").upsert(catRows, { onConflict: "id" });
        if (catErr) {
          console.warn("Categories sync warning:", catErr.message);
        } else {
          results.push(`Categories (${catRows.length})`);
        }
      }
      if (Array.isArray(state.bills) && state.bills.length > 0) {
        const billRows = state.bills.map((b) => ({
          id: Number(b.id),
          name: b.name || "Untitled Bill",
          category: b.category || "housing",
          amount: parseFloat(b.amount) || 0,
          paid_amount: parseFloat(b.paidAmount ?? 0),
          due: b.due || "\u2014",
          month: b.month || "Aug",
          year: parseInt(b.year, 10) || 2026,
          timing: b.timing || "upcoming",
          photo: b.photo ? typeof b.photo === "string" ? b.photo : JSON.stringify(b.photo) : null,
          logo: b.logo || null,
          payment_plan: !!b.paymentPlan,
          notes: b.notes || "",
          paid_by: b.paidBy || null,
          escalation: b.escalation || null,
          iban: b.iban || null,
          reference: b.reference || null,
          payments: b.payments || [],
          sort_order: b.sortOrder ?? 0,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }));
        const { error: billErr } = await supabase.from("bills").upsert(billRows, { onConflict: "id" });
        if (billErr) {
          console.warn("Bills sync warning:", billErr.message);
        } else {
          results.push(`Bills (${billRows.length})`);
        }
      }
      if (Array.isArray(state.accounts) && state.accounts.length > 0) {
        const accRows = state.accounts.map((a) => ({
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
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }));
        const { error: accErr } = await supabase.from("accounts").upsert(accRows, { onConflict: "id" });
        if (accErr) {
          console.warn("Accounts sync warning:", accErr.message);
        } else {
          results.push(`Accounts (${accRows.length})`);
        }
      }
      if (state.groceries) {
        try {
          const { error: grocErr } = await supabase.from("groceries").upsert(
            {
              id: "main",
              budget: state.groceries.budget || 400,
              entries: state.groceries.entries || [],
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            },
            { onConflict: "id" }
          );
          if (!grocErr) results.push("Groceries");
        } catch (grocEx) {
          console.warn("Groceries sync warning:", grocEx?.message);
        }
      }
      try {
        await supabase.from("app_settings").upsert(
          {
            id: "global",
            verse: state.verse || null,
            subscriptions: state.subscriptions || [],
            currency: state.currency || { code: "EUR", symbol: "\u20AC" },
            language: state.language || "en",
            monthly_budget_cap: state.monthlyBudgetCap || 2500,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          },
          { onConflict: "id" }
        );
        results.push("Settings");
      } catch (setEx) {
        console.warn("Settings sync warning:", setEx?.message);
      }
      return res.json({
        success: true,
        message: `Synced to Supabase: ${results.join(", ")}`,
        pushedCount: results.length
      });
    } catch (err) {
      console.error("Supabase push error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to push state to Supabase database."
      });
    }
  });
  app.get("/api/sync/pull", async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (!supabase) {
        return res.status(500).json({
          success: false,
          error: "Supabase server connection is not initialized."
        });
      }
      const updates = {};
      try {
        const { data: catData, error: catErr } = await supabase.from("categories").select("*").order("sort_order", { ascending: true });
        if (!catErr && catData && catData.length > 0) {
          updates.categories = catData.map((row) => ({
            id: String(row.id),
            name: row.name || "Untitled",
            color: row.color || "#7B6EF6",
            description: row.description || "",
            featured: !!row.featured,
            logo: row.logo || null,
            sortOrder: row.sort_order ?? row.sortOrder ?? 0
          }));
        }
      } catch (e) {
        console.warn("Pull categories warning:", e?.message);
      }
      try {
        const { data: billData, error: billErr } = await supabase.from("bills").select("*").order("sort_order", { ascending: true });
        if (!billErr && billData && billData.length > 0) {
          updates.bills = billData.map((row) => {
            let photo = null;
            if (row.photo) {
              try {
                photo = typeof row.photo === "string" ? JSON.parse(row.photo) : row.photo;
              } catch {
                photo = null;
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
              name: row.name || "Untitled Bill",
              category: row.category || "housing",
              amount: parseFloat(row.amount) || 0,
              paidAmount: parseFloat(row.paid_amount ?? row.paidAmount ?? 0),
              due: row.due || "\u2014",
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
              sortOrder: row.sort_order ?? row.sortOrder ?? 0
            };
          });
        }
      } catch (e) {
        console.warn("Pull bills warning:", e?.message);
      }
      try {
        const { data: accData, error: accErr } = await supabase.from("accounts").select("*");
        if (!accErr && accData && accData.length > 0) {
          updates.accounts = accData.map((row) => ({
            id: String(row.id),
            label: row.label || row.id,
            tag: row.tag || null,
            bankFeedUrl: row.bank_feed_url ?? row.bankFeedUrl ?? null,
            hasGroceries: !!(row.has_groceries ?? row.hasGroceries),
            transactions: Array.isArray(row.transactions) ? row.transactions : [],
            goals: Array.isArray(row.goals) ? row.goals : [],
            bills: Array.isArray(row.bills) ? row.bills : [],
            budgets: Array.isArray(row.budgets) ? row.budgets : [],
            loans: Array.isArray(row.loans) ? row.loans : []
          }));
        }
      } catch (e) {
        console.warn("Pull accounts warning:", e?.message);
      }
      try {
        const { data: grocData, error: grocErr } = await supabase.from("groceries").select("*").limit(1);
        if (!grocErr && grocData && grocData[0]) {
          updates.groceries = {
            budget: parseFloat(grocData[0].budget) || 400,
            entries: Array.isArray(grocData[0].entries) ? grocData[0].entries : []
          };
        }
      } catch (e) {
        console.warn("Pull groceries warning:", e?.message);
      }
      try {
        const { data: setData, error: setErr } = await supabase.from("app_settings").select("*").limit(1);
        if (!setErr && setData && setData[0]) {
          if (setData[0].verse) updates.verse = setData[0].verse;
          if (setData[0].subscriptions) updates.subscriptions = setData[0].subscriptions;
          if (setData[0].currency) updates.currency = setData[0].currency;
          if (setData[0].language) updates.language = setData[0].language;
          if (setData[0].monthly_budget_cap !== void 0 && setData[0].monthly_budget_cap !== null) {
            updates.monthlyBudgetCap = parseFloat(setData[0].monthly_budget_cap);
          }
        }
      } catch (e) {
        console.warn("Pull settings warning:", e?.message);
      }
      return res.json({
        success: true,
        data: updates
      });
    } catch (err) {
      console.error("Supabase pull error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to pull state from Supabase database."
      });
    }
  });
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
      `DTSTAMP:${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}`,
      "SUMMARY:\u{1F514} Ledger Calendar Feed Connected",
      "DESCRIPTION:Your live household bill schedule is linked. Active bills and payment due dates will appear here with alarms.",
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:Household bill due tomorrow",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    res.send(sampleIcs);
  });
  app.post("/api/calendar/export-feed", (req, res) => {
    try {
      const { bills = [], currencySymbol = "\u20AC", recipients = [] } = req.body;
      const events = bills.map((b, index) => {
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
        const dtstamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
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
          `SUMMARY:\u{1F4B8} Bill: ${b.name} (${currencySymbol}${rem.toFixed(2)})`,
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
          "END:VEVENT"
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
        "END:VCALENDAR"
      ].join("\r\n");
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="household_bills_schedule.ics"');
      return res.send(feedIcs);
    } catch (e) {
      return res.status(500).json({ error: e?.message || "Failed to build calendar" });
    }
  });
  app.post("/api/gemini/extract-bill", async (req, res) => {
    try {
      const { image, mimeType = "image/jpeg", categories = [], currencySymbol = "\u20AC" } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!image) {
        return res.status(400).json({
          success: false,
          error: "No image data provided for bill extraction."
        });
      }
      let rawBase64 = image;
      let detectedMime = mimeType;
      if (typeof image === "string" && image.includes(";base64,")) {
        const parts = image.split(";base64,");
        detectedMime = parts[0].replace("data:", "") || mimeType;
        rawBase64 = parts[1];
      }
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
            userActionPrompt: "Gemini API key not configured yet. We have primed the form for you\u2014please verify the bill name and amount.",
            missingFields: ["amount", "dueDateIso"],
            extractedData: {
              name: "Scanned Invoice",
              category: categories[0]?.id || "housing",
              amount: null,
              dueDateIso: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
              iban: "",
              reference: "",
              escalation: null,
              notes: "Scanned invoice receipt"
            }
          }
        });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const prompt = `You are an expert AI invoice, receipt, and utility bill scanner for household budgeting.
Analyze the provided document/photo.

Available categories in app: ${JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name })))}
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
          data: rawBase64
        }
      };
      const textPart = {
        text: prompt
      };
      const modelsToTry = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];
      let parsedExtraction = null;
      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [imagePart, textPart] },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: import_genai.Type.OBJECT,
                properties: {
                  isBill: { type: import_genai.Type.BOOLEAN },
                  readability: { type: import_genai.Type.STRING },
                  confidenceScore: { type: import_genai.Type.NUMBER },
                  needsRetake: { type: import_genai.Type.BOOLEAN },
                  statusMessage: { type: import_genai.Type.STRING },
                  userActionPrompt: { type: import_genai.Type.STRING },
                  missingFields: {
                    type: import_genai.Type.ARRAY,
                    items: { type: import_genai.Type.STRING }
                  },
                  extractedData: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      name: { type: import_genai.Type.STRING },
                      category: { type: import_genai.Type.STRING },
                      amount: { type: import_genai.Type.NUMBER },
                      dueDateIso: { type: import_genai.Type.STRING },
                      iban: { type: import_genai.Type.STRING },
                      reference: { type: import_genai.Type.STRING },
                      escalation: { type: import_genai.Type.STRING },
                      notes: { type: import_genai.Type.STRING }
                    }
                  }
                },
                required: [
                  "isBill",
                  "readability",
                  "confidenceScore",
                  "needsRetake",
                  "statusMessage",
                  "missingFields",
                  "extractedData"
                ]
              }
            }
          });
          const resText = response.text || "{}";
          parsedExtraction = JSON.parse(resText);
          if (parsedExtraction && typeof parsedExtraction.isBill === "boolean") {
            return res.json({
              success: true,
              source: "gemini-vision",
              modelUsed: modelName,
              data: parsedExtraction
            });
          }
        } catch (modelErr) {
          console.warn(`Extraction model ${modelName} error:`, modelErr?.message || modelErr);
        }
      }
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
            dueDateIso: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
            iban: "",
            reference: "",
            escalation: null,
            notes: ""
          }
        }
      });
    } catch (error) {
      console.error("Bill extraction endpoint failure:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to extract information from document."
      });
    }
  });
  app.post("/api/gemini/monthly-feedback", async (req, res) => {
    try {
      const { month, year, bills, groceries, accounts, currencySymbol } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      const symbol = currencySymbol || "\u20AC";
      const monthName = month || "current";
      const yearNum = year || 2026;
      if (!apiKey) {
        return res.json({
          success: true,
          source: "local-engine",
          data: generateAlgorithmicFeedback({ month: monthName, year: yearNum, bills, groceries, accounts, symbol })
        });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
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
- actionPlan (array of 3-5 objects each with: title (string), description (string), priority ('high' | 'medium' | 'low'), impact (string, e.g. "Save ~\u20AC45/mo" or "Avoid late penalties"))
`;
      let parsedData = null;
      const modelsToTry = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];
      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: import_genai.Type.OBJECT,
                properties: {
                  overallScore: { type: import_genai.Type.NUMBER },
                  monthTitle: { type: import_genai.Type.STRING },
                  executiveSummary: { type: import_genai.Type.STRING },
                  keyHighlights: {
                    type: import_genai.Type.ARRAY,
                    items: { type: import_genai.Type.STRING }
                  },
                  groceryInsights: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      spentAmount: { type: import_genai.Type.NUMBER },
                      budgetStatus: { type: import_genai.Type.STRING },
                      observation: { type: import_genai.Type.STRING },
                      shoppingPacingTips: {
                        type: import_genai.Type.ARRAY,
                        items: { type: import_genai.Type.STRING }
                      }
                    },
                    required: ["spentAmount", "budgetStatus", "observation", "shoppingPacingTips"]
                  },
                  billsOptimization: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      totalDue: { type: import_genai.Type.NUMBER },
                      totalPaid: { type: import_genai.Type.NUMBER },
                      overdueRiskNote: { type: import_genai.Type.STRING },
                      recommendations: {
                        type: import_genai.Type.ARRAY,
                        items: { type: import_genai.Type.STRING }
                      }
                    },
                    required: ["totalDue", "totalPaid", "overdueRiskNote", "recommendations"]
                  },
                  savingsAndGoals: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      statusNote: { type: import_genai.Type.STRING },
                      recommendations: {
                        type: import_genai.Type.ARRAY,
                        items: { type: import_genai.Type.STRING }
                      }
                    },
                    required: ["statusNote", "recommendations"]
                  },
                  actionPlan: {
                    type: import_genai.Type.ARRAY,
                    items: {
                      type: import_genai.Type.OBJECT,
                      properties: {
                        title: { type: import_genai.Type.STRING },
                        description: { type: import_genai.Type.STRING },
                        priority: { type: import_genai.Type.STRING },
                        impact: { type: import_genai.Type.STRING }
                      },
                      required: ["title", "description", "priority", "impact"]
                    }
                  }
                },
                required: [
                  "overallScore",
                  "monthTitle",
                  "executiveSummary",
                  "keyHighlights",
                  "groceryInsights",
                  "billsOptimization",
                  "savingsAndGoals",
                  "actionPlan"
                ]
              }
            }
          });
          const responseText = response.text || "{}";
          parsedData = JSON.parse(responseText);
          if (parsedData && parsedData.overallScore !== void 0) {
            return res.json({
              success: true,
              source: "gemini-ai",
              modelUsed: modelName,
              data: parsedData
            });
          }
        } catch (modelError) {
          console.warn(`Model ${modelName} temporary issue (${modelError?.status || modelError?.message || "unavailable"}), attempting next tier...`);
        }
      }
      const fallback = generateAlgorithmicFeedback({
        month: monthName,
        year: yearNum,
        bills,
        groceries,
        accounts,
        symbol
      });
      return res.json({
        success: true,
        source: "local-engine",
        fallbackNote: "Analysis prepared using automated personal metrics engine.",
        data: fallback
      });
    } catch (error) {
      console.warn("Generating algorithmic feedback fallback:", error?.message || error);
      const { month, year, bills, groceries, accounts, currencySymbol } = req.body;
      const fallback = generateAlgorithmicFeedback({
        month: month || "current",
        year: year || 2026,
        bills,
        groceries,
        accounts,
        symbol: currencySymbol || "\u20AC"
      });
      return res.json({
        success: true,
        source: "local-engine",
        fallbackNote: "Analysis prepared using automated local metrics engine.",
        data: fallback
      });
    }
  });
  return app;
}
function generateAlgorithmicFeedback(ctx) {
  const { month, year, bills = [], groceries, accounts = [], symbol } = ctx;
  const monthBills = bills.filter((b) => !b.month || b.month === month);
  const totalBillsAmt = monthBills.reduce((s, b) => s + (b.amount || 0), 0);
  const totalBillsPaid = monthBills.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const remainingBills = Math.max(0, totalBillsAmt - totalBillsPaid);
  const overdueBills = monthBills.filter(
    (b) => b.timing === "overdue" && (b.paidAmount || 0) < (b.amount || 0)
  );
  const groceryEntries = (groceries?.entries || []).filter(
    (e) => e.month === month && (!e.year || e.year === year)
  );
  const grocerySpent = groceryEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const groceryBudget = groceries?.budget || 0;
  let groceryRatio = groceryBudget > 0 ? grocerySpent / groceryBudget : 0.8;
  let groceryStatus = "on-track";
  if (groceryBudget > 0) {
    if (grocerySpent > groceryBudget) groceryStatus = "over";
    else if (grocerySpent > groceryBudget * 0.85) groceryStatus = "approaching";
    else groceryStatus = "under";
  }
  let score = 80;
  if (overdueBills.length > 0) score -= overdueBills.length * 12;
  if (groceryStatus === "over") score -= 15;
  else if (groceryStatus === "under") score += 8;
  if (remainingBills === 0 && totalBillsAmt > 0) score += 10;
  score = Math.max(25, Math.min(98, Math.round(score)));
  const actionPlan = [];
  if (overdueBills.length > 0) {
    actionPlan.push({
      title: `Prioritize ${overdueBills.length} Overdue Bill${overdueBills.length > 1 ? "s" : ""}`,
      description: `Settle ${overdueBills.map((b) => b.name).join(", ")} (${symbol}${overdueBills.reduce((s, b) => s + (b.amount - (b.paidAmount || 0)), 0).toFixed(2)}) immediately to avoid administrative reminder penalties.`,
      priority: "high",
      impact: "Avoid collection surcharges and protect credit standing"
    });
  }
  if (groceryBudget > 0 && grocerySpent > groceryBudget) {
    actionPlan.push({
      title: "Rebalance Grocery Outflow",
      description: `Grocery purchases (${symbol}${grocerySpent.toFixed(2)}) exceeded your target by ${symbol}${(grocerySpent - groceryBudget).toFixed(2)}. Consider batch meal planning and combining weekly store runs.`,
      priority: "medium",
      impact: `Potential monthly saving of ${symbol}${(grocerySpent - groceryBudget).toFixed(2)}`
    });
  } else if (groceryBudget > 0) {
    actionPlan.push({
      title: "Maintain Grocery Discipline",
      description: `You have spent ${symbol}${grocerySpent.toFixed(2)} of your ${symbol}${groceryBudget.toFixed(2)} allowance (${Math.round((1 - grocerySpent / groceryBudget) * 100)}% remaining buffer).`,
      priority: "low",
      impact: "Preserves discretionary cash buffer"
    });
  }
  actionPlan.push({
    title: "Automate Emergency Buffer Transfers",
    description: "Schedule a recurring fixed transfer directly following salary deposit to build a resilient multi-month safety net.",
    priority: "medium",
    impact: "Builds peace of mind and long-term liquidity"
  });
  return {
    overallScore: score,
    monthTitle: `${month} ${year} Financial Review`,
    executiveSummary: `For ${month} ${year}, your overall financial health score is ${score}/100. ${overdueBills.length > 0 ? `You have ${overdueBills.length} outstanding bill(s) requiring immediate settlement.` : "Your fixed bill settlements are progressing smoothly."} Grocery outflow is currently ${groceryStatus === "over" ? "above" : "within"} planned targets.`,
    keyHighlights: [
      `${symbol}${totalBillsPaid.toFixed(2)} settled in fixed obligations this month.`,
      `${groceryEntries.length} grocery shopping trips logged totaling ${symbol}${grocerySpent.toFixed(2)}.`,
      overdueBills.length === 0 ? "Zero overdue billing escalations recorded." : `${overdueBills.length} bill(s) flagged for payment attention.`,
      `Active savings and account balances monitored across all ledgers.`
    ],
    groceryInsights: {
      spentAmount: grocerySpent,
      budgetStatus: groceryStatus,
      observation: groceryBudget > 0 ? `You have utilized ${(groceryRatio * 100).toFixed(0)}% of your ${symbol}${groceryBudget.toFixed(2)} grocery budget across ${groceryEntries.length} trips.` : `Total grocery expenditure stands at ${symbol}${grocerySpent.toFixed(2)}. Setting a monthly cap will help forecast savings.`,
      shoppingPacingTips: [
        "Consolidate trips to 1-2 times weekly to curb spontaneous impulse items.",
        "Check staple inventory before visiting discount supermarkets (e.g. Lidl) before specialty stores.",
        "Take advantage of supermarket loyalty bonus apps and bulk staples discounts."
      ]
    },
    billsOptimization: {
      totalDue: totalBillsAmt,
      totalPaid: totalBillsPaid,
      overdueRiskNote: overdueBills.length > 0 ? `Immediate attention required: ${overdueBills.map((b) => b.name).join(", ")}.` : "All active obligations are current with no late escalation notices.",
      recommendations: [
        "Audit recurring digital and physical subscriptions quarterly to eliminate unused services.",
        "Ensure payment plan schedules remain aligned with monthly incoming cash flow.",
        "Set up automated calendar reminders 3 days before critical due dates."
      ]
    },
    savingsAndGoals: {
      statusNote: "Consistent micro-deposits compound significantly over quarterly cycles.",
      recommendations: [
        "Target maintaining 3 months of essential fixed costs in your liquid emergency account.",
        "Allocate any grocery budget surplus directly into your top priority savings goal at month-end."
      ]
    },
    actionPlan
  };
}

// server.ts
async function startServer() {
  const PORT = Number(process.env.PORT) || 3e3;
  const app = await createApiApp();
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express2.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
