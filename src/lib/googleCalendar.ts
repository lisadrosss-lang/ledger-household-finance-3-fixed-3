import { signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleCalendarProvider } from "./firebase";
import { Bill } from "../types";
import { formatCurrency, getRemaining, dueToISO, CURRENT_YEAR } from "./storage";
import { ReminderRecipient } from "./calendar";

// In-memory token cache
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export interface CalendarSyncResult {
  billId: number;
  billName: string;
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
}

export function getCalendarAccessToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentCalendarUser(): User | null {
  return cachedUser || auth.currentUser;
}

/**
 * Sign in with Google to get an access token for Google Calendar API
 */
export async function connectGoogleCalendar(): Promise<{ user: User; accessToken: string }> {
  try {
    const result = await signInWithPopup(auth, googleCalendarProvider);
    // @ts-expect-error credentialFromResult is available
    const credential = googleCalendarProvider.constructor.credentialFromResult
      ? // @ts-expect-error standard firebase auth helper
        googleCalendarProvider.constructor.credentialFromResult(result)
      : null;

    // Retrieve access token
    let accessToken: string | null = null;
    if (credential && credential.accessToken) {
      accessToken = credential.accessToken;
    } else {
      // In Firebase v10+, the credential from result has accessToken:
      const { GoogleAuthProvider } = await import("firebase/auth");
      const cred = GoogleAuthProvider.credentialFromResult(result);
      if (cred?.accessToken) {
        accessToken = cred.accessToken;
      }
    }

    if (!accessToken) {
      throw new Error("Could not retrieve Google Calendar access token. Please verify permissions.");
    }

    cachedAccessToken = accessToken;
    cachedUser = result.user;

    return { user: result.user, accessToken };
  } catch (error: any) {
    console.error("Google Calendar connection error:", error);
    throw error;
  }
}

/**
 * Disconnect Google Calendar
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  cachedAccessToken = null;
  cachedUser = null;
  await signOut(auth);
}

/**
 * Helper to build start and end date objects for Google Calendar API
 */
function buildEventDateObjects(bill: Bill): { start: any; end: any } {
  const iso = dueToISO(bill.due, bill.year || CURRENT_YEAR);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";

  if (!iso) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      start: { date: today },
      end: { date: today },
    };
  }

  // Use all-day date or specific morning time
  return {
    start: {
      dateTime: `${iso}T09:00:00`,
      timeZone,
    },
    end: {
      dateTime: `${iso}T10:00:00`,
      timeZone,
    },
  };
}

/**
 * Sync a single bill to user's Google Calendar via Google Calendar v3 API
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  bill: Bill,
  currencySymbol: string,
  recipients: ReminderRecipient[] = []
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  const rem = getRemaining(bill);
  const summary = `💸 Bill Due: ${bill.name} (${formatCurrency(rem, currencySymbol)})`;

  let description = `Household & Personal Bill Reminder\n\n`;
  description += `• Item: ${bill.name}\n`;
  description += `• Amount Due: ${formatCurrency(rem, currencySymbol)}\n`;
  description += `• Due Date: ${bill.due} ${bill.year || CURRENT_YEAR}\n`;
  if (bill.category) description += `• Category: ${bill.category}\n`;
  if (bill.iban) description += `• IBAN: ${bill.iban}\n`;
  if (bill.reference) description += `• Payment Reference: ${bill.reference}\n`;
  if (bill.notes) description += `• Notes: ${bill.notes}\n`;
  description += `\n— Synced from Ledger Financial Management`;

  const { start, end } = buildEventDateObjects(bill);

  // Attendees list from active recipients
  const attendees = recipients
    .filter((r) => r.enabled && r.email && r.email.trim().includes("@"))
    .map((r) => ({
      email: r.email.trim(),
      displayName: r.name || "Recipient",
    }));

  const payload: any = {
    summary,
    description,
    start,
    end,
    location: bill.iban ? `IBAN: ${bill.iban}` : "Online Banking",
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 1440 }, // 24 hours before
        { method: "popup", minutes: 4320 }, // 3 days before
        { method: "email", minutes: 1440 }, // 1 day before email notification
      ],
    },
  };

  if (attendees.length > 0) {
    payload.attendees = attendees;
  }

  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Google Calendar API error (${response.status})`);
    }

    const data = await response.json();
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err: any) {
    console.error(`Failed to create calendar event for ${bill.name}:`, err);
    return {
      success: false,
      error: err.message || "Failed to sync to Google Calendar",
    };
  }
}

/**
 * Sync multiple unpaid bills to Google Calendar
 */
export async function syncAllBillsToGoogleCalendar(
  accessToken: string,
  bills: Bill[],
  currencySymbol: string,
  recipients: ReminderRecipient[] = []
): Promise<CalendarSyncResult[]> {
  const results: CalendarSyncResult[] = [];

  for (const bill of bills) {
    const res = await createGoogleCalendarEvent(accessToken, bill, currencySymbol, recipients);
    results.push({
      billId: bill.id,
      billName: bill.name,
      success: res.success,
      eventId: res.eventId,
      htmlLink: res.htmlLink,
      error: res.error,
    });
  }

  return results;
}
