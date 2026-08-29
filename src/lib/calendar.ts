import { Bill } from "../types";
import { formatCurrency, getRemaining, isBillUrgent, dueToISO, CURRENT_YEAR } from "./storage";

export interface ReminderRecipient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  enabled?: boolean;
}

const RECIPIENTS_STORAGE_KEY = "ledger_reminder_recipients";

export const DEFAULT_RECIPIENTS: ReminderRecipient[] = [
  {
    id: "lisa-primary",
    name: "Lisa",
    email: "lisadrosss@gmail.com",
    phone: "",
    role: "Primary / Self",
    enabled: true,
  },
  {
    id: "partner-secondary",
    name: "Partner / Housemate",
    email: "",
    phone: "",
    role: "Household",
    enabled: true,
  },
];

export function loadReminderRecipients(): ReminderRecipient[] {
  try {
    const raw = localStorage.getItem(RECIPIENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to read reminder recipients:", e);
  }
  return DEFAULT_RECIPIENTS;
}

export function saveReminderRecipients(recipients: ReminderRecipient[]) {
  try {
    localStorage.setItem(RECIPIENTS_STORAGE_KEY, JSON.stringify(recipients));
  } catch (e) {
    console.warn("Failed to save reminder recipients:", e);
  }
}

/**
 * Get the live subscribable webcal / iCal link to paste into Google Calendar
 * (Just like school schedule subscribe links)
 */
export function getSubscribableCalendarUrl(): string {
  const origin = window.location.origin;
  return `${origin}/api/calendar/feed.ics`;
}

/**
 * Generate quick "Add URL to Google Calendar" link
 */
export function getGoogleCalendarSubscriptionUrl(): string {
  const feedUrl = encodeURIComponent(getSubscribableCalendarUrl());
  return `https://calendar.google.com/calendar/render?cid=${feedUrl}`;
}

/**
 * Format date for Google Calendar and iCal (YYYYMMDD or YYYYMMDDTHHMMSSZ)
 */
function getEventDates(bill: Bill): { startDate: string; endDate: string; isAllDay: boolean } {
  const iso = dueToISO(bill.due, bill.year || CURRENT_YEAR);
  if (!iso) {
    const now = new Date();
    const formatted = now.toISOString().replace(/-|:|\.\d+/g, "").slice(0, 8);
    return { startDate: formatted, endDate: formatted, isAllDay: true };
  }
  // format: YYYYMMDD
  const clean = iso.replace(/-/g, "");
  // Start at 09:00 morning of due date, end 10:00
  const startDateTime = `${clean}T090000Z`;
  const endDateTime = `${clean}T100000Z`;
  return { startDate: startDateTime, endDate: endDateTime, isAllDay: false };
}

/**
 * Generate Google Calendar Web URL with attendees
 */
export function buildGoogleCalendarUrl(
  bill: Bill,
  currencySymbol: string,
  recipients: ReminderRecipient[]
): string {
  const rem = getRemaining(bill);
  const title = encodeURIComponent(`💸 Bill Due: ${bill.name} (${formatCurrency(rem, currencySymbol)})`);
  
  let detailsText = `Household Bill Reminder for ${bill.name}\n\n`;
  detailsText += `Amount Due: ${formatCurrency(rem, currencySymbol)}\n`;
  detailsText += `Due Date: ${bill.due} ${bill.year}\n`;
  if (bill.iban) detailsText += `IBAN: ${bill.iban}\n`;
  if (bill.reference) detailsText += `Payment Reference: ${bill.reference}\n`;
  if (bill.notes) detailsText += `Notes: ${bill.notes}\n`;
  detailsText += `\nManaged via Ledger Household Finance`;

  const details = encodeURIComponent(detailsText);
  const { startDate, endDate } = getEventDates(bill);

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}`;
  if (bill.iban) {
    url += `&location=${encodeURIComponent(`IBAN: ${bill.iban}`)}`;
  }

  // Add all active recipient emails as attendees
  const activeEmails = recipients
    .filter((r) => r.enabled && r.email && r.email.trim().includes("@"))
    .map((r) => r.email.trim());

  if (activeEmails.length > 0) {
    url += `&add=${encodeURIComponent(activeEmails.join(","))}`;
  }

  return url;
}

/**
 * Generate standard iCalendar (.ics) event string with VALARM and ATTENDEE tags
 */
export function generateSingleIcs(
  bill: Bill,
  currencySymbol: string,
  recipients: ReminderRecipient[]
): string {
  const rem = getRemaining(bill);
  const iso = dueToISO(bill.due, bill.year || CURRENT_YEAR);
  const dateStr = (iso || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const uid = `bill-${bill.id}-${bill.year}-${Date.now()}@ledger.app`;
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  let attendeesStr = "";
  recipients
    .filter((r) => r.enabled && r.email && r.email.trim().includes("@"))
    .forEach((r) => {
      attendeesStr += `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${r.name || "Recipient"}:mailto:${r.email.trim()}\r\n`;
    });

  let desc = `Household Bill Reminder: ${bill.name}\\n`;
  desc += `Amount Due: ${formatCurrency(rem, currencySymbol)}\\n`;
  desc += `Due Date: ${bill.due} ${bill.year}\\n`;
  if (bill.iban) desc += `IBAN: ${bill.iban}\\n`;
  if (bill.reference) desc += `Reference: ${bill.reference}\\n`;
  if (bill.notes) desc += `Notes: ${bill.notes.replace(/\n/g, " ")}\\n`;

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:💸 Bill Due: ${bill.name} (${formatCurrency(rem, currencySymbol)})`,
    `DESCRIPTION:${desc}`,
    bill.iban ? `LOCATION:IBAN ${bill.iban}` : "LOCATION:Online Banking",
    "STATUS:CONFIRMED",
    attendeesStr.trimEnd(),
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${bill.name} is due tomorrow!`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-P3D",
    "ACTION:DISPLAY",
    `DESCRIPTION:Upcoming: ${bill.name} is due in 3 days.`,
    "END:VALARM",
    "END:VEVENT",
  ]
    .filter((line) => line && line.length > 0)
    .join("\r\n");
}

/**
 * Generate a complete multi-event .ics calendar file for all unpaid bills
 */
export function generateBatchIcs(
  bills: Bill[],
  currencySymbol: string,
  recipients: ReminderRecipient[]
): string {
  const events = bills.map((b) => generateSingleIcs(b, currencySymbol, recipients)).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ledger Household App//Bill Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "X-WR-CALNAME:Household Bill Due Dates",
    "X-WR-TIMEZONE:UTC",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Trigger download of .ics file
 */
export function downloadIcsFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build mailto URL targeting all active recipients
 */
export function buildMultiRecipientMailto(
  recipients: ReminderRecipient[],
  bills: Bill[],
  currencySymbol: string,
  totalOwed: number,
  monthName: string,
  yearNum: number
): string {
  const activeRecipients = recipients.filter((r) => r.enabled && r.email && r.email.includes("@"));
  const toEmails = activeRecipients.map((r) => r.email.trim());
  const toParam = toEmails.join(",");

  const subject = encodeURIComponent(
    `🔔 Household Bill Reminder (${monthName} ${yearNum}): ${formatCurrency(totalOwed, currencySymbol)} Due`
  );

  let body = `Hello ${activeRecipients.map((r) => r.name).join(", ") || "Household"},\n\n`;
  body += `Here is the current summary of upcoming and unpaid bills that need attention:\n\n`;
  body += `💰 Total Pending: ${formatCurrency(totalOwed, currencySymbol)}\n`;
  body += `📌 Total Unpaid Bills: ${bills.length}\n\n`;
  body += `────────────────────────────\n`;

  bills.forEach((b, idx) => {
    const rem = getRemaining(b);
    const urgent = isBillUrgent(b);
    body += `${idx + 1}. ${b.name}\n`;
    body += `   • Due: ${b.due} ${b.year}${urgent ? " ⚠️ (OVERDUE)" : ""}\n`;
    body += `   • Amount: ${formatCurrency(rem, currencySymbol)}\n`;
    if (b.iban) body += `   • IBAN: ${b.iban}\n`;
    if (b.reference) body += `   • Reference: ${b.reference}\n`;
    if (b.notes) body += `   • Notes: ${b.notes}\n`;
    body += `\n`;
  });

  body += `Please ensure payment is completed before the due dates.\n\n`;
  body += `Sent from Ledger Household Finance App.`;

  return `mailto:${toParam}?subject=${subject}&body=${encodeURIComponent(body)}`;
}

/**
 * Build WhatsApp share link for group or direct recipient
 */
export function buildWhatsAppLink(phone: string | undefined, message: string): string {
  const cleanPhone = phone ? phone.replace(/[^\d+]/g, "") : "";
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
