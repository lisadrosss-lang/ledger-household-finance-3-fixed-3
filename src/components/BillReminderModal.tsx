import React, { useState, useEffect } from "react";
import { AppState, Bill } from "../types";
import {
  formatCurrency,
  getRemaining,
  getPaymentStatus,
  isBillUrgent,
  CURRENT_MONTH,
  CURRENT_YEAR,
} from "../lib/storage";
import {
  ReminderRecipient,
  loadReminderRecipients,
  saveReminderRecipients,
  buildGoogleCalendarUrl,
  generateSingleIcs,
  generateBatchIcs,
  downloadIcsFile,
  buildMultiRecipientMailto,
  buildWhatsAppLink,
  getSubscribableCalendarUrl,
  getGoogleCalendarSubscriptionUrl,
} from "../lib/calendar";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getCalendarAccessToken,
  getCurrentCalendarUser,
  createGoogleCalendarEvent,
  syncAllBillsToGoogleCalendar,
  CalendarSyncResult,
} from "../lib/googleCalendar";
import {
  Bell,
  Copy,
  Check,
  Share2,
  AlertTriangle,
  Calendar,
  Send,
  Sparkles,
  ExternalLink,
  Users,
  Plus,
  Trash2,
  Mail,
  MessageCircle,
  Download,
  CheckCircle2,
  Clock,
  UserCheck,
  Link2,
  Smartphone,
  Layers,
  HelpCircle,
  RefreshCw,
  LogOut,
} from "lucide-react";

interface BillReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onUpdateBill?: (updated: Bill) => void;
  onShowToast: (msg: string) => void;
}

export const BillReminderModal: React.FC<BillReminderModalProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateBill,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<"gcal" | "calendar" | "reminders" | "recipients">("gcal");
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedCalendarLink, setCopiedCalendarLink] = useState(false);
  const [filterType, setFilterType] = useState<"all_unpaid" | "urgent_only" | "next_7_days">("all_unpaid");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // Google Calendar Connection state
  const [isConnectingGCal, setIsConnectingGCal] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingBillId, setSyncingBillId] = useState<number | null>(null);
  const [gcalUser, setGcalUser] = useState<any>(getCurrentCalendarUser());
  const [gcalToken, setGcalToken] = useState<string | null>(getCalendarAccessToken());
  const [syncResults, setSyncResults] = useState<Record<number, CalendarSyncResult>>({});

  // Multi-person recipients state
  const [recipients, setRecipients] = useState<ReminderRecipient[]>(loadReminderRecipients);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientPhone, setNewRecipientPhone] = useState("");
  const [newRecipientRole, setNewRecipientRole] = useState("Household");
  const [showAddRecipient, setShowAddRecipient] = useState(false);

  useEffect(() => {
    saveReminderRecipients(recipients);
  }, [recipients]);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }
    setGcalUser(getCurrentCalendarUser());
    setGcalToken(getCalendarAccessToken());
  }, [isOpen]);

  if (!isOpen) return null;

  // Collect unpaid bills
  const unpaidBills = state.bills.filter((b) => getPaymentStatus(b) !== "paid");

  // Filter bills based on selected tab
  const filteredBills = unpaidBills.filter((b) => {
    if (filterType === "urgent_only") {
      return isBillUrgent(b);
    }
    if (filterType === "next_7_days") {
      return isBillUrgent(b) || b.month === CURRENT_MONTH;
    }
    return true;
  });

  const totalOwed = filteredBills.reduce((s, b) => s + getRemaining(b), 0);
  const urgentCount = filteredBills.filter(isBillUrgent).length;
  const activeRecipients = recipients.filter((r) => r.enabled);

  const subscribableUrl = getSubscribableCalendarUrl();

  // Handle Google Calendar Authentication
  const handleConnectGoogle = async () => {
    setIsConnectingGCal(true);
    try {
      const { user, accessToken } = await connectGoogleCalendar();
      setGcalUser(user);
      setGcalToken(accessToken);
      onShowToast(`Connected to Google Calendar as ${user.displayName || user.email}!`);
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Could not connect to Google Calendar.");
    } finally {
      setIsConnectingGCal(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await disconnectGoogleCalendar();
      setGcalUser(null);
      setGcalToken(null);
      setSyncResults({});
      onShowToast("Disconnected Google Calendar.");
    } catch (err) {
      console.error(err);
    }
  };

  // Sync All Unpaid Bills Directly to User's Google Calendar
  const handleSyncAllToGoogleCalendar = async () => {
    if (!gcalToken) {
      await handleConnectGoogle();
      return;
    }

    if (filteredBills.length === 0) {
      onShowToast("No unpaid bills to sync!");
      return;
    }

    setIsSyncingAll(true);
    try {
      const results = await syncAllBillsToGoogleCalendar(
        gcalToken,
        filteredBills,
        state.currency.symbol,
        recipients
      );

      const resultMap: Record<number, CalendarSyncResult> = {};
      let successCount = 0;
      results.forEach((r) => {
        resultMap[r.billId] = r;
        if (r.success) successCount++;
      });

      setSyncResults((prev) => ({ ...prev, ...resultMap }));
      onShowToast(`Successfully added ${successCount} bill reminder(s) to your Google Calendar! 📅`);
    } catch (err: any) {
      onShowToast(err.message || "Failed to sync reminders to Google Calendar.");
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Sync single bill to Google Calendar
  const handleSyncSingleToGoogleCalendar = async (bill: Bill) => {
    let token = gcalToken;
    if (!token) {
      try {
        setIsConnectingGCal(true);
        const authRes = await connectGoogleCalendar();
        token = authRes.accessToken;
        setGcalUser(authRes.user);
        setGcalToken(token);
      } catch (e: any) {
        onShowToast("Google authentication required to sync.");
        setIsConnectingGCal(false);
        return;
      } finally {
        setIsConnectingGCal(false);
      }
    }

    setSyncingBillId(bill.id);
    try {
      const res = await createGoogleCalendarEvent(
        token,
        bill,
        state.currency.symbol,
        recipients
      );

      setSyncResults((prev) => ({
        ...prev,
        [bill.id]: {
          billId: bill.id,
          billName: bill.name,
          success: res.success,
          eventId: res.eventId,
          htmlLink: res.htmlLink,
          error: res.error,
        },
      }));

      if (res.success) {
        onShowToast(`Added "${bill.name}" reminder to Google Calendar!`);
      } else {
        onShowToast(res.error || "Failed to create Google Calendar reminder.");
      }
    } catch (err: any) {
      onShowToast(err.message || "Error syncing to Google Calendar.");
    } finally {
      setSyncingBillId(null);
    }
  };

  const handleCopyCalendarLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(subscribableUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = subscribableUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCalendarLink(true);
      onShowToast("Calendar subscription link copied! Paste into Google Calendar.");
      setTimeout(() => setCopiedCalendarLink(false), 2500);
    } catch (err) {
      onShowToast("Failed to copy link.");
    }
  };

  const handleOpenGoogleCalendarSubscription = () => {
    const url = getGoogleCalendarSubscriptionUrl();
    window.open(url, "_blank", "noopener,noreferrer");
    onShowToast("Opening Google Calendar subscribe page...");
  };

  // Formatted summary text for copy/whatsapp
  const generateSummaryText = () => {
    let text = `📋 Household Bills Summary (${CURRENT_MONTH} ${CURRENT_YEAR})\n`;
    text += `💰 Due: ${formatCurrency(totalOwed, state.currency.symbol)} (${filteredBills.length} bills)\n`;
    if (activeRecipients.length > 0) {
      text += `👥 Members: ${activeRecipients.map((r) => r.name).join(", ")}\n`;
    }
    text += `\n`;

    filteredBills.forEach((b, index) => {
      const rem = getRemaining(b);
      const isOverdue = isBillUrgent(b);
      text += `${index + 1}. ${b.name}: ${formatCurrency(rem, state.currency.symbol)} (Due: ${b.due})${
        isOverdue ? " ⚠️ OVERDUE" : ""
      }\n`;
      if (b.iban) text += `   IBAN: ${b.iban}\n`;
      if (b.reference) text += `   Ref: ${b.reference}\n`;
    });

    return text;
  };

  const handleCopySummary = async () => {
    const summary = generateSummaryText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summary);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = summary;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedSummary(true);
      onShowToast("Payment summary copied to clipboard!");
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch (err) {
      onShowToast("Failed to copy summary.");
    }
  };

  const handleShare = async () => {
    const summary = generateSummaryText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bills Payment Summary (${CURRENT_MONTH} ${CURRENT_YEAR})`,
          text: summary,
        });
        onShowToast("Summary shared!");
      } catch (err) {
        // user cancelled
      }
    } else {
      handleCopySummary();
    }
  };

  const handleSendEmailToAll = () => {
    if (activeRecipients.length === 0) {
      onShowToast("Please add at least one household recipient in the 'Recipients' tab.");
      setActiveTab("recipients");
      return;
    }
    const mailto = buildMultiRecipientMailto(
      recipients,
      filteredBills,
      state.currency.symbol,
      totalOwed,
      CURRENT_MONTH,
      CURRENT_YEAR
    );
    window.location.href = mailto;
    onShowToast(`Opened email draft to ${activeRecipients.length} recipient(s)`);
  };

  const handleDownloadBatchIcs = () => {
    if (filteredBills.length === 0) {
      onShowToast("No bills available to export.");
      return;
    }
    const icsContent = generateBatchIcs(filteredBills, state.currency.symbol, recipients);
    downloadIcsFile(`Household_Bills_${CURRENT_MONTH}_${CURRENT_YEAR}.ics`, icsContent);
    onShowToast(`Downloaded calendar file (.ics) with alarms`);
  };

  const handleOpenGoogleCalendarSingle = (bill: Bill) => {
    const gCalUrl = buildGoogleCalendarUrl(bill, state.currency.symbol, recipients);
    window.open(gCalUrl, "_blank", "noopener,noreferrer");
    onShowToast(`Opening Google Calendar for ${bill.name}`);
  };

  const handleDownloadSingleIcs = (bill: Bill) => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ledger Household App//Bill Reminder//EN",
      generateSingleIcs(bill, state.currency.symbol, recipients),
      "END:VCALENDAR",
    ].join("\r\n");
    downloadIcsFile(`Bill_${bill.name.replace(/\s+/g, "_")}.ics`, ics);
    onShowToast(`Downloaded calendar reminder for ${bill.name}`);
  };

  // Device & Browser Alerts
  const handleTriggerBrowserAlert = async () => {
    if (typeof Notification === "undefined") {
      onShowToast("Browser notifications are not supported on this browser.");
      return;
    }

    setSendingNotif(true);
    let perm = Notification.permission;
    if (perm !== "granted") {
      try {
        perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch (err) {
        console.warn("Notification permission error:", err);
      }
    }

    if (perm === "granted") {
      try {
        const urgentFirst = filteredBills.find(isBillUrgent) || filteredBills[0];
        const title = `🚨 Bill Alert: ${formatCurrency(totalOwed, state.currency.symbol)} Due`;
        const body = urgentFirst
          ? `Urgent: ${urgentFirst.name} (${formatCurrency(
              getRemaining(urgentFirst),
              state.currency.symbol
            )}) due ${urgentFirst.due}. Total ${filteredBills.length} unpaid bill(s).`
          : `You have ${filteredBills.length} upcoming bill(s) totaling ${formatCurrency(
              totalOwed,
              state.currency.symbol
            )}.`;

        new Notification(title, {
          body,
          icon: "/icon.png",
        });
        onShowToast("Browser alert dispatched!");
      } catch (e) {
        onShowToast("Device notification triggered.");
      }
    } else {
      onShowToast("Please enable notifications in your browser permission settings.");
    }
    setSendingNotif(false);
  };

  // Recipient management handlers
  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientName.trim()) {
      onShowToast("Please provide a name.");
      return;
    }

    const newRec: ReminderRecipient = {
      id: `rec-${Date.now()}`,
      name: newRecipientName.trim(),
      email: newRecipientEmail.trim(),
      phone: newRecipientPhone.trim(),
      role: newRecipientRole.trim() || "Household",
      enabled: true,
    };

    setRecipients([...recipients, newRec]);
    setNewRecipientName("");
    setNewRecipientEmail("");
    setNewRecipientPhone("");
    setShowAddRecipient(false);
    onShowToast(`Added ${newRec.name}!`);
  };

  const handleToggleRecipient = (id: string) => {
    setRecipients(
      recipients.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRecipient = (id: string) => {
    setRecipients(recipients.filter((r) => r.id !== id));
    onShowToast("Recipient removed");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-[26px] max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-black/10 max-h-[92vh] flex flex-col space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#B0459E] flex items-center justify-center text-white shadow-xs">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#2B2740]">
                Google Calendar & Reminders
              </h3>
              <p className="text-xs text-[#2B2740]/60">
                Live Google Calendar sync, automated alarms & household alerts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-sm font-bold text-[#2B2740]/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-black/[0.04] p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("gcal")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "gcal"
                ? "bg-white text-[#7C3AED] shadow-xs"
                : "text-[#2B2740]/60 hover:text-[#2B2740]"
            }`}
          >
            <Calendar size={13} />
            <span>Google Calendar</span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "calendar"
                ? "bg-white text-[#7C3AED] shadow-xs"
                : "text-[#2B2740]/60 hover:text-[#2B2740]"
            }`}
          >
            <Clock size={13} />
            <span>Due List ({filteredBills.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("reminders")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "reminders"
                ? "bg-white text-[#7C3AED] shadow-xs"
                : "text-[#2B2740]/60 hover:text-[#2B2740]"
            }`}
          >
            <Smartphone size={13} />
            <span>Device Alerts</span>
          </button>
          <button
            onClick={() => setActiveTab("recipients")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "recipients"
                ? "bg-white text-[#7C3AED] shadow-xs"
                : "text-[#2B2740]/60 hover:text-[#2B2740]"
            }`}
          >
            <Users size={13} />
            <span>Recipients ({activeRecipients.length})</span>
          </button>
        </div>

        {/* TAB 1: GOOGLE CALENDAR DIRECT API SYNC & SCHEDULE LINK */}
        {activeTab === "gcal" && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Live Google Calendar Connection Card */}
            <div className="bg-gradient-to-br from-[#7C3AED]/10 via-[#B0459E]/10 to-[#F2994A]/10 rounded-2xl p-4 border border-[#7C3AED]/20 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white shadow-xs flex items-center justify-center p-1.5 border border-black/10">
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                      <path fill="#4285F4" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
                      <path fill="#34A853" d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-[#2B2740] flex items-center gap-1.5">
                      <span>Google Calendar Direct Sync</span>
                      {gcalUser && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[11px] text-[#2B2740]/60">
                      {gcalUser
                        ? `Connected: ${gcalUser.displayName || gcalUser.email}`
                        : "Connect to create calendar events & pop-up alarms automatically"}
                    </div>
                  </div>
                </div>

                {gcalUser && (
                  <button
                    onClick={handleDisconnectGoogle}
                    className="text-[11px] text-[#E5484D] hover:underline font-bold flex items-center gap-1"
                    title="Disconnect Google Account"
                  >
                    <LogOut size={12} />
                    <span>Disconnect</span>
                  </button>
                )}
              </div>

              {/* Status or Google Sign In Button */}
              {!gcalUser ? (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGCal}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-black/[0.02] border border-black/15 shadow-xs text-xs font-extrabold text-[#2B2740] flex items-center justify-center gap-2.5 active:scale-95 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isConnectingGCal ? "Connecting..." : "Sign in with Google Calendar"}</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleSyncAllToGoogleCalendar}
                    disabled={isSyncingAll}
                    className="w-full py-3 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D3AED] text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <RefreshCw size={14} className={isSyncingAll ? "animate-spin" : ""} />
                    <span>
                      {isSyncingAll
                        ? "Syncing all bills to Google Calendar..."
                        : `Sync All Unpaid Bills (${filteredBills.length}) to Google Calendar`}
                    </span>
                  </button>

                  <div className="text-[11px] text-center text-[#2B2740]/60 flex items-center justify-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span>Includes 24h & 3-day notification reminders + IBAN details</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Add Subscription / WebCal Feed Link */}
            <div className="bg-white rounded-2xl p-4 border border-black/[0.06] shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center">
                  <Link2 size={16} />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-[#2B2740]">
                    Subscribable iCal Calendar Link
                  </div>
                  <div className="text-[11px] text-[#2B2740]/60">
                    Live schedule link that auto-syncs with Google Calendar, Apple Calendar, or Outlook
                  </div>
                </div>
              </div>

              <div className="bg-black/[0.02] rounded-xl p-2.5 border border-black/10 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={subscribableUrl}
                  className="w-full text-xs font-mono text-[#2B2740] bg-transparent focus:outline-none select-all"
                />
                <button
                  onClick={handleCopyCalendarLink}
                  className="px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D3AED] text-white font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all flex-shrink-0"
                >
                  {copiedCalendarLink ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedCalendarLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleOpenGoogleCalendarSubscription}
                  className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-black/[0.02] border border-black/10 text-xs font-extrabold text-[#2B2740] flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <ExternalLink size={13} className="text-[#7C3AED]" />
                  <span>Open in Google Calendar</span>
                </button>

                <button
                  onClick={handleDownloadBatchIcs}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-black/[0.02] border border-black/10 text-xs font-extrabold text-[#2B2740] flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <Download size={13} className="text-[#7C3AED]" />
                  <span>Download .ICS</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="bg-white rounded-2xl p-4 border border-black/[0.06] shadow-xs space-y-2.5">
              <div className="text-xs font-extrabold text-[#2B2740] flex items-center gap-1.5">
                <HelpCircle size={14} className="text-[#7C3AED]" />
                <span>How Google Calendar Sync Works:</span>
              </div>

              <div className="space-y-2 text-xs text-[#2B2740]/80">
                <div className="flex items-start gap-2 bg-black/[0.02] p-2.5 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <span>
                    <strong>Direct 1-Click Sync</strong>: Click "Sign in with Google Calendar" to sync bills directly onto your Google Calendar schedule with alarms.
                  </span>
                </div>

                <div className="flex items-start gap-2 bg-black/[0.02] p-2.5 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <span>
                    <strong>Auto-Updating Link</strong>: Or copy the subscribable calendar link and add it under <em>Google Calendar &rarr; Other Calendars &rarr; From URL</em>.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DUE LIST & CALENDAR ACTIONS */}
        {activeTab === "calendar" && (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {(
                  [
                    ["all_unpaid", `All (${unpaidBills.length})`],
                    ["urgent_only", `Urgent (${urgentCount})`],
                    ["next_7_days", `${CURRENT_MONTH}`],
                  ] as const
                ).map(([fKey, fLabel]) => (
                  <button
                    key={fKey}
                    onClick={() => setFilterType(fKey)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs ${
                      filterType === fKey
                        ? "bg-[#7C3AED] text-white"
                        : "bg-white text-[#2B2740]/60 border border-black/10"
                    }`}
                  >
                    {fLabel}
                  </button>
                ))}
              </div>

              {gcalUser && (
                <button
                  onClick={handleSyncAllToGoogleCalendar}
                  disabled={isSyncingAll}
                  className="px-3 py-1 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#B0459E] text-white text-xs font-bold flex items-center gap-1 shadow-xs hover:opacity-95"
                >
                  <RefreshCw size={11} className={isSyncingAll ? "animate-spin" : ""} />
                  <span>Sync All</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {filteredBills.length > 0 ? (
                filteredBills.map((bill) => {
                  const rem = getRemaining(bill);
                  const isOverdue = isBillUrgent(bill);
                  const syncStatus = syncResults[bill.id];

                  return (
                    <div
                      key={bill.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isOverdue
                          ? "bg-[#E5484D]/[0.03] border-[#E5484D]/30"
                          : "bg-white border-black/[0.06]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-[#2B2740] truncate">
                              {bill.name}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] bg-[#E5484D]/15 text-[#E5484D] px-1.5 py-0.2 rounded font-bold">
                                Overdue
                              </span>
                            )}
                            {syncStatus?.success && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                                <Check size={10} /> Synced to GCal
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#2B2740]/60 mt-0.5 flex items-center gap-2">
                            <span>📅 Due: {bill.due} {bill.year}</span>
                            {bill.iban && <span className="font-mono truncate">• {bill.iban}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono font-bold text-sm text-[#2B2740]">
                            {formatCurrency(rem, state.currency.symbol)}
                          </div>
                        </div>
                      </div>

                      {/* Individual Calendar Actions */}
                      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-black/[0.04] flex-wrap">
                        {gcalUser ? (
                          <button
                            onClick={() => handleSyncSingleToGoogleCalendar(bill)}
                            disabled={syncingBillId === bill.id}
                            className="px-2.5 py-1 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D3AED] font-bold text-[11px] flex items-center gap-1 transition-all"
                          >
                            <Calendar size={11} />
                            <span>
                              {syncingBillId === bill.id
                                ? "Syncing..."
                                : syncStatus?.success
                                ? "Re-sync to GCal"
                                : "Sync to GCal"}
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenGoogleCalendarSingle(bill)}
                            className="px-2.5 py-1 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20 font-bold text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink size={11} />
                            <span>Add to GCal</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDownloadSingleIcs(bill)}
                          className="px-2.5 py-1 rounded-lg bg-black/[0.04] text-[#2B2740]/70 hover:bg-black/[0.08] font-bold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <Download size={11} />
                          <span>.ICS File</span>
                        </button>

                        {syncStatus?.htmlLink && (
                          <a
                            href={syncStatus.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#7C3AED] hover:underline font-bold flex items-center gap-1 ml-auto"
                          >
                            <span>Open in Calendar &rarr;</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-[#2B2740]/50 bg-black/[0.02] rounded-2xl">
                  🎉 No unpaid bills in this view!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DEVICE & BROWSER ALERTS */}
        {activeTab === "reminders" && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Metric Summary Card */}
            <div className="bg-gradient-to-br from-[#7C3AED]/10 via-[#B0459E]/10 to-[#F2994A]/10 rounded-2xl p-4 border border-[#7C3AED]/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider">
                  Total Pending Payment
                </div>
                <div className="text-2xl font-extrabold text-[#2B2740] font-mono mt-0.5">
                  {formatCurrency(totalOwed, state.currency.symbol)}
                </div>
                <div className="text-[11px] text-[#2B2740]/60 mt-0.5">
                  {filteredBills.length} bill(s) · {activeRecipients.length} household recipient(s)
                </div>
              </div>
              {urgentCount > 0 && (
                <div className="flex flex-col items-end">
                  <span className="px-2.5 py-1 rounded-full bg-[#E5484D] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs">
                    <AlertTriangle size={12} /> {urgentCount} Urgent
                  </span>
                </div>
              )}
            </div>

            {/* Device & Browser Notification Alert Banner */}
            <div className="bg-white rounded-2xl p-4 border border-black/[0.06] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E5484D] to-[#F2994A] text-white flex items-center justify-center">
                    <Bell size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-[#2B2740]">Device & Browser Alerts</div>
                    <div className="text-[11px] text-[#2B2740]/60">
                      Receive local browser pop-up notifications for due dates
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                    notificationPermission === "granted"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                  }`}
                >
                  {notificationPermission === "granted" ? "✓ Enabled" : "⚠️ Permission required"}
                </span>
              </div>

              <button
                onClick={handleTriggerBrowserAlert}
                disabled={sendingNotif}
                className="w-full py-2.5 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D3AED] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <Bell size={14} />
                <span>Trigger Device / Browser Alert Now</span>
              </button>
            </div>

            {/* Multi-Person Broadcast Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#2B2740]/60">
                <span>Multi-User Broadcast & Sharing</span>
                <button
                  onClick={() => setActiveTab("recipients")}
                  className="text-[#7C3AED] hover:underline flex items-center gap-1"
                >
                  <Users size={12} />
                  <span>Manage {recipients.length} people</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleSendEmailToAll}
                  className="py-2.5 px-3 rounded-xl bg-white border border-black/[0.08] hover:bg-black/[0.02] text-[#2B2740] font-bold text-xs shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Mail size={14} className="text-[#7C3AED]" />
                  <span>Email All Recipients ({activeRecipients.length})</span>
                </button>

                <a
                  href={buildWhatsAppLink(
                    recipients.find((r) => r.phone)?.phone,
                    generateSummaryText()
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#128C7E] font-bold text-xs shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
                >
                  <MessageCircle size={14} />
                  <span>WhatsApp Household Update</span>
                </a>
              </div>
            </div>

            {/* Copy & Native Notification Actions */}
            <div className="pt-2 border-t border-black/[0.06] space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleCopySummary}
                  className="py-2.5 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D3AED] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  {copiedSummary ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedSummary ? "Copied to Clipboard!" : "Copy Summary Text"}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="py-2.5 px-4 rounded-xl bg-[#B0459E] hover:bg-[#9D3C8C] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Share2 size={15} />
                  <span>Share via Native Menu</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RECIPIENTS */}
        {activeTab === "recipients" && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold text-[#2B2740]">Household Members & Recipients</div>
                <div className="text-[11px] text-[#2B2740]/60">
                  People who receive calendar invites and reminder broadcasts
                </div>
              </div>
              <button
                onClick={() => setShowAddRecipient(!showAddRecipient)}
                className="px-3 py-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-[#6D3AED] active:scale-95 transition-all"
              >
                <Plus size={13} />
                <span>Add Person</span>
              </button>
            </div>

            {/* Add Recipient Form */}
            {showAddRecipient && (
              <form
                onSubmit={handleAddRecipient}
                className="bg-white rounded-2xl p-4 border border-[#7C3AED]/30 shadow-sm space-y-3"
              >
                <div className="text-xs font-extrabold text-[#2B2740]">New Reminder Recipient</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#2B2740]/60 block mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lisa, Alex, Accountant"
                      value={newRecipientName}
                      onChange={(e) => setNewRecipientName(e.target.value)}
                      className="w-full p-2 rounded-xl border border-black/10 text-xs focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#2B2740]/60 block mb-1">Role / Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. Primary, Roommate, Partner"
                      value={newRecipientRole}
                      onChange={(e) => setNewRecipientRole(e.target.value)}
                      className="w-full p-2 rounded-xl border border-black/10 text-xs focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#2B2740]/60 block mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. lisa@example.com"
                      value={newRecipientEmail}
                      onChange={(e) => setNewRecipientEmail(e.target.value)}
                      className="w-full p-2 rounded-xl border border-black/10 text-xs focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#2B2740]/60 block mb-1">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      placeholder="e.g. +31612345678"
                      value={newRecipientPhone}
                      onChange={(e) => setNewRecipientPhone(e.target.value)}
                      className="w-full p-2 rounded-xl border border-black/10 text-xs focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-full bg-[#7C3AED] text-white font-bold text-xs shadow-xs hover:bg-[#6D3AED]"
                  >
                    Save Recipient
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddRecipient(false)}
                    className="px-4 py-2 rounded-full bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* List of Recipients */}
            <div className="space-y-2">
              {recipients.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white rounded-2xl p-3.5 border border-black/[0.06] shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={rec.enabled}
                      onChange={() => handleToggleRecipient(rec.id)}
                      className="rounded text-[#7C3AED] w-4 h-4 cursor-pointer"
                    />
                    <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {rec.name[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-[#2B2740] truncate">
                          {rec.name}
                        </span>
                        {rec.role && (
                          <span className="text-[10px] bg-black/[0.05] text-[#2B2740]/70 px-1.5 py-0.2 rounded font-semibold">
                            {rec.role}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#2B2740]/50 truncate mt-0.5">
                        {rec.email || "No email"} {rec.phone ? `· ${rec.phone}` : ""}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteRecipient(rec.id)}
                    className="text-[#2B2740]/30 hover:text-[#E5484D] transition-colors p-1"
                    title="Remove recipient"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
