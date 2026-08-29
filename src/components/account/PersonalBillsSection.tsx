import React, { useState, useRef } from "react";
import { AppState, Account, AccountBill, BillPhoto, PaymentEntry } from "../../types";
import { formatCurrency, monthOrder, CURRENT_MONTH, CURRENT_YEAR, periodKey } from "../../lib/storage";
import { optimizeAndConvertToPdf } from "../../lib/fileOptimizer";
import {
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  ExternalLink,
  Download,
  Copy,
  Check,
  Edit3,
  Calendar,
  AlertTriangle,
  Receipt,
  X,
  CreditCard,
  ChevronDown,
} from "lucide-react";

interface PersonalBillsSectionProps {
  state: AppState;
  account: Account;
  onUpdateAccount: (updated: Account) => void;
  onShowToast: (msg: string) => void;
}

export const PersonalBillsSection: React.FC<PersonalBillsSectionProps> = ({
  state,
  account,
  onUpdateAccount,
  onShowToast,
}) => {
  const bills = account.bills || [];

  // Filter states
  const [activeFilter, setActiveFilter] = useState<"all" | "urgent" | "upcoming" | "partial" | "paid">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  // Add Bill Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [billName, setBillName] = useState("");
  const [billCategory, setBillCategory] = useState(state.categories[0]?.id || "housing");
  const [billAmount, setBillAmount] = useState("");
  const [billDue, setBillDue] = useState("");
  const [billMonth, setBillMonth] = useState(CURRENT_MONTH);
  const [billYear, setBillYear] = useState(CURRENT_YEAR);
  const [billPaidAmount, setBillPaidAmount] = useState("");
  const [billTiming, setBillTiming] = useState<"upcoming" | "overdue">("upcoming");
  const [billEscalation, setBillEscalation] = useState<"reminder" | "aanmaning" | "deurwaarder" | null>(null);
  const [billPaymentPlan, setBillPaymentPlan] = useState(false);
  const [billIban, setBillIban] = useState("");
  const [billRef, setBillRef] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [billPhoto, setBillPhoto] = useState<BillPhoto | null>(null);

  // Selected Bill for Full Detail Modal / Payments Ledger
  const [selectedBill, setSelectedBill] = useState<AccountBill | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editIban, setEditIban] = useState("");
  const [editRef, setEditRef] = useState("");

  // Add payment inline state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentBy, setPaymentBy] = useState("Lisa");
  const [copiedIban, setCopiedIban] = useState(false);

  // File input refs
  const addModalFileInputRef = useRef<HTMLInputElement>(null);
  const detailFileInputRef = useRef<HTMLInputElement>(null);

  // Derive periods
  const periodMap: Record<string, { month: string; year: number; key: string }> = {};
  bills.forEach((b) => {
    const m = b.month || CURRENT_MONTH;
    const y = b.year || CURRENT_YEAR;
    const key = `${m}-${y}`;
    if (!periodMap[key]) periodMap[key] = { month: m, year: y, key };
  });
  const periodList = Object.values(periodMap).sort(
    (a, b) => periodKey(b.year, b.month) - periodKey(a.year, a.month)
  );

  // Filter calculation helpers
  const getBillPaidAmount = (b: AccountBill): number => {
    if (b.paidAmount !== undefined) return b.paidAmount;
    if (b.payments && b.payments.length > 0) {
      return b.payments.reduce((s, p) => s + p.amount, 0);
    }
    return b.paid ? b.amount : 0;
  };

  const getBillRemaining = (b: AccountBill): number => {
    const paidAmt = getBillPaidAmount(b);
    return Math.max(0, b.amount - paidAmt);
  };

  const getBillStatus = (b: AccountBill): "paid" | "partial" | "unpaid" => {
    const paidAmt = getBillPaidAmount(b);
    if (b.paid || (b.amount > 0 && paidAmt >= b.amount)) return "paid";
    if (paidAmt > 0 && paidAmt < b.amount) return "partial";
    return "unpaid";
  };

  const isUrgent = (b: AccountBill): boolean => {
    const status = getBillStatus(b);
    if (status === "paid") return false;
    return b.timing === "overdue" || b.escalation !== null;
  };

  // Period filtered bills
  const periodBills = bills.filter((b) => {
    if (periodFilter === "all") return true;
    const m = b.month || CURRENT_MONTH;
    const y = b.year || CURRENT_YEAR;
    return `${m}-${y}` === periodFilter;
  });

  const urgentBills = periodBills.filter(isUrgent);
  const upcomingBills = periodBills.filter((b) => b.timing !== "overdue" && getBillStatus(b) !== "paid");
  const partialBills = periodBills.filter((b) => getBillStatus(b) === "partial");
  const paidBills = periodBills.filter((b) => getBillStatus(b) === "paid");

  const summaryDefs = [
    { key: "urgent" as const, label: "Urgent", color: "#E5484D", items: urgentBills, amt: urgentBills.reduce((s, b) => s + getBillRemaining(b), 0) },
    { key: "upcoming" as const, label: "Upcoming", color: "#7C3AED", items: upcomingBills, amt: upcomingBills.reduce((s, b) => s + getBillRemaining(b), 0) },
    { key: "partial" as const, label: "Partial", color: "#F5B94E", items: partialBills, amt: partialBills.reduce((s, b) => s + getBillRemaining(b), 0) },
    { key: "paid" as const, label: "Paid", color: "#2E9E71", items: paidBills, amt: paidBills.reduce((s, b) => s + b.amount, 0) },
  ];

  const filteredBills = periodBills.filter((b) => {
    if (categoryFilter && b.category !== categoryFilter) return false;
    if (activeFilter === "all") return true;
    if (activeFilter === "urgent") return isUrgent(b);
    if (activeFilter === "upcoming") return b.timing !== "overdue" && getBillStatus(b) !== "paid";
    if (activeFilter === "partial") return getBillStatus(b) === "partial";
    if (activeFilter === "paid") return getBillStatus(b) === "paid";
    return true;
  });

  // Handle file uploads (converts to optimized PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isDetail = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeAndConvertToPdf(file);
      const photoObj: BillPhoto = {
        type: optimized.type,
        name: optimized.name,
        data: optimized.data,
      };
      if (isDetail && selectedBill) {
        const updatedBill: AccountBill = { ...selectedBill, photo: photoObj };
        onUpdateAccount({
          ...account,
          bills: bills.map((b) => (b.id === selectedBill.id ? updatedBill : b)),
        });
        setSelectedBill(updatedBill);
        onShowToast(`Attached & converted PDF document (${optimized.savingsText})`);
      } else {
        setBillPhoto(photoObj);
        onShowToast(`Converted & attached PDF (${optimized.savingsText})`);
      }
    } catch {
      onShowToast("Failed to process document attachment");
    }
  };

  const handleAddBill = () => {
    const amt = parseFloat(billAmount);
    if (!billName.trim() || isNaN(amt) || amt <= 0) {
      onShowToast("Please enter bill name and valid amount");
      return;
    }
    const initialPaid = parseFloat(billPaidAmount) || 0;
    const isPaid = initialPaid >= amt;

    const newBill: AccountBill = {
      id: Date.now(),
      name: billName.trim(),
      category: billCategory,
      amount: amt,
      paidAmount: initialPaid,
      due: billDue.trim() || `${billMonth} 15`,
      month: billMonth,
      year: billYear,
      timing: billTiming,
      escalation: billEscalation,
      paymentPlan: billPaymentPlan,
      iban: billIban.trim() || null,
      reference: billRef.trim() || null,
      notes: billNotes.trim() || undefined,
      paid: isPaid,
      photo: billPhoto,
      payments: initialPaid > 0 ? [{ id: Date.now(), amount: initialPaid, paidBy: "Lisa", month: billMonth, year: billYear }] : [],
    };

    onUpdateAccount({
      ...account,
      bills: [...bills, newBill],
    });

    // Reset
    setBillName("");
    setBillAmount("");
    setBillDue("");
    setBillPaidAmount("");
    setBillIban("");
    setBillRef("");
    setBillNotes("");
    setBillPhoto(null);
    setBillEscalation(null);
    setBillPaymentPlan(false);
    setShowAddModal(false);
    onShowToast("Personal bill added successfully");
  };

  const handleTogglePaid = (b: AccountBill) => {
    const newPaid = !b.paid;
    const updated: AccountBill = {
      ...b,
      paid: newPaid,
      paidAmount: newPaid ? b.amount : 0,
      payments: newPaid
        ? [{ id: Date.now(), amount: b.amount, paidBy: "Lisa", month: b.month || CURRENT_MONTH, year: b.year || CURRENT_YEAR }]
        : [],
    };
    onUpdateAccount({
      ...account,
      bills: bills.map((item) => (item.id === b.id ? updated : item)),
    });
    if (selectedBill?.id === b.id) setSelectedBill(updated);
    onShowToast(newPaid ? `Marked "${b.name}" as paid` : `Marked "${b.name}" as unpaid`);
  };

  const handleAddPayment = () => {
    if (!selectedBill) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      onShowToast("Please enter a valid payment amount");
      return;
    }
    const currentPaid = getBillPaidAmount(selectedBill);
    const newPaidTotal = currentPaid + amt;
    const isNowPaid = newPaidTotal >= selectedBill.amount;

    const newPayment: PaymentEntry = {
      id: Date.now(),
      amount: amt,
      paidBy: paymentBy.trim() || "Lisa",
      month: selectedBill.month || CURRENT_MONTH,
      year: selectedBill.year || CURRENT_YEAR,
      created_at: new Date().toISOString(),
    };

    const updatedBill: AccountBill = {
      ...selectedBill,
      paidAmount: newPaidTotal,
      paid: isNowPaid,
      paidBy: paymentBy.trim() || "Lisa",
      payments: [...(selectedBill.payments || []), newPayment],
    };

    onUpdateAccount({
      ...account,
      bills: bills.map((b) => (b.id === selectedBill.id ? updatedBill : b)),
    });

    setSelectedBill(updatedBill);
    setPaymentAmount("");
    onShowToast(`Payment of ${formatCurrency(amt, state.currency.symbol)} recorded`);
  };

  const handleDeletePayment = (paymentId: number) => {
    if (!selectedBill || !selectedBill.payments) return;
    const newPayments = selectedBill.payments.filter((p) => p.id !== paymentId);
    const newPaidTotal = newPayments.reduce((s, p) => s + p.amount, 0);
    const updatedBill: AccountBill = {
      ...selectedBill,
      paidAmount: newPaidTotal,
      paid: newPaidTotal >= selectedBill.amount,
      payments: newPayments,
    };
    onUpdateAccount({
      ...account,
      bills: bills.map((b) => (b.id === selectedBill.id ? updatedBill : b)),
    });
    setSelectedBill(updatedBill);
    onShowToast("Payment removed");
  };

  const handleDeleteBill = (billId: number) => {
    onUpdateAccount({
      ...account,
      bills: bills.filter((b) => b.id !== billId),
    });
    if (selectedBill?.id === billId) setSelectedBill(null);
    onShowToast("Bill deleted");
  };

  const handleSaveEditDetails = () => {
    if (!selectedBill) return;
    const numAmt = parseFloat(editAmount);
    const updatedBill: AccountBill = {
      ...selectedBill,
      name: editName.trim() || selectedBill.name,
      due: editDue.trim() || selectedBill.due,
      amount: isNaN(numAmt) || numAmt <= 0 ? selectedBill.amount : numAmt,
      iban: editIban.trim() || null,
      reference: editRef.trim() || null,
    };
    onUpdateAccount({
      ...account,
      bills: bills.map((b) => (b.id === selectedBill.id ? updatedBill : b)),
    });
    setSelectedBill(updatedBill);
    setIsEditingDetails(false);
    onShowToast("Bill details updated");
  };

  const handleOpenPdf = (dataUrl: string, fileName: string) => {
    const w = window.open();
    if (w) {
      w.document.write(
        `<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0; left:0; width:100%; height:100%;" allowfullscreen></iframe>`
      );
      w.document.title = fileName;
    } else {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    }
  };

  const handleDownloadPdf = (dataUrl: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyIban = (iban: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedIban(true);
    onShowToast("IBAN copied to clipboard");
    setTimeout(() => setCopiedIban(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar with Month & Add Bill */}
      <div className="flex items-center justify-between">
        <div className="relative inline-flex items-center">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="appearance-none text-xs font-bold pl-3.5 pr-8 py-1.5 rounded-full border border-black/10 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 text-[#2B2740] cursor-pointer hover:border-black/20 transition-all"
          >
            <option value="all">All Months</option>
            {periodList.map((p) => (
              <option key={p.key} value={p.key}>
                {p.month} {p.year}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#2B2740]/60"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D3AED] shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus size={15} />
          <span>Add Bill</span>
        </button>
      </div>

      {/* Summary 4-Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {summaryDefs.map((s) => {
          const isActive = activeFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActiveFilter(isActive ? "all" : s.key)}
              style={{ borderLeftColor: s.color }}
              className={`bg-white rounded-2xl p-3 shadow-sm border border-l-4 border-black/[0.04] text-left transition-all ${
                isActive ? "ring-2 ring-[#7C3AED] shadow-md" : "hover:-translate-y-0.5"
              }`}
            >
              <div className="font-bold text-[11px] text-[#2B2740]/60 truncate mb-0.5">
                {s.label} · {s.items.length}
              </div>
              <div className="font-mono font-extrabold text-sm text-[#2B2740]">
                {formatCurrency(s.amt, state.currency.symbol)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Category Chips Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-xs ${
            categoryFilter === null
              ? "bg-[#7C3AED] text-white"
              : "bg-white text-[#2B2740]/60 hover:bg-black/5"
          }`}
        >
          All Categories
        </button>
        {state.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-xs flex items-center gap-1.5 ${
              categoryFilter === c.id
                ? "bg-[#7C3AED] text-white"
                : "bg-white text-[#2B2740]/70 hover:bg-black/5"
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      {/* Bills Stack */}
      <div className="space-y-2.5">
        {filteredBills.length > 0 ? (
          filteredBills.map((b) => {
            const cat = state.categories.find((c) => c.id === b.category);
            const status = getBillStatus(b);
            const rem = getBillRemaining(b);
            const paidAmt = getBillPaidAmount(b);
            const hasDoc = !!b.photo;

            return (
              <div
                key={b.id}
                onClick={() => {
                  setSelectedBill(b);
                  setEditName(b.name);
                  setEditDue(b.due);
                  setEditAmount(b.amount.toString());
                  setEditIban(b.iban || "");
                  setEditRef(b.reference || "");
                }}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all cursor-pointer hover:shadow-md ${
                  status === "paid"
                    ? "border-emerald-500/30 bg-emerald-50/10"
                    : isUrgent(b)
                    ? "border-[#E5484D]/30"
                    : "border-black/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Category indicator */}
                    <div
                      className="w-2.5 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat?.color || "#7C3AED" }}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-[#2B2740] truncate">{b.name}</span>
                        {cat && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                          >
                            {cat.name}
                          </span>
                        )}
                        {b.escalation && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E5484D]/10 text-[#E5484D] uppercase">
                            {b.escalation}
                          </span>
                        )}
                        {b.paymentPlan && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5B94E]/20 text-[#B0740E]">
                            Plan
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#2B2740]/50 mt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar size={12} /> {b.due}
                        </span>
                        {hasDoc && (
                          <span className="flex items-center gap-1 text-[#7C3AED] font-bold">
                            <FileText size={12} /> PDF Scan
                          </span>
                        )}
                        {b.notes && <span className="truncate max-w-[140px]">· {b.notes}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Status badge */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-extrabold text-sm text-[#2B2740]">
                        {formatCurrency(b.amount, state.currency.symbol)}
                      </div>
                      <div className="text-[10px] font-bold font-mono">
                        {status === "paid" ? (
                          <span className="text-[#2E9E71]">Paid in full</span>
                        ) : status === "partial" ? (
                          <span className="text-[#B0740E]">
                            Left: {formatCurrency(rem, state.currency.symbol)}
                          </span>
                        ) : (
                          <span className={isUrgent(b) ? "text-[#E5484D]" : "text-[#2B2740]/50"}>
                            {b.timing === "overdue" ? "Overdue" : "Unpaid"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Paid Quick Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePaid(b);
                      }}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                        status === "paid"
                          ? "bg-[#2E9E71] text-white shadow-xs"
                          : "border-2 border-black/20 hover:border-[#7C3AED] text-transparent hover:text-[#7C3AED]"
                      }`}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center text-xs text-[#2B2740]/50 border border-black/[0.04] space-y-2">
            <Receipt size={24} className="mx-auto text-[#7C3AED]/40" />
            <p>No bills found matching this filter.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-xs font-bold text-[#7C3AED] hover:underline"
            >
              + Add a bill with invoice picture or PDF scan
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD BILL WITH DOCUMENT UPLOAD */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">Add Personal Bill</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740] hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Bill Name</label>
                <input
                  type="text"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  placeholder="e.g. Health Insurance, Internet / Wifi, City Tax"
                  className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-medium focus:outline-none focus:border-[#7C3AED]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Category</label>
                  <select
                    value={billCategory}
                    onChange={(e) => setBillCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white font-medium"
                  >
                    {state.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                    Amount ({state.currency.symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Due Date</label>
                  <input
                    type="text"
                    value={billDue}
                    onChange={(e) => setBillDue(e.target.value)}
                    placeholder="e.g. Sep 15"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Timing</label>
                  <select
                    value={billTiming}
                    onChange={(e) => setBillTiming(e.target.value as "upcoming" | "overdue")}
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white font-medium"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="overdue">Overdue / Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                    Escalation Level
                  </label>
                  <select
                    value={billEscalation || ""}
                    onChange={(e) =>
                      setBillEscalation((e.target.value as any) || null)
                    }
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white font-medium"
                  >
                    <option value="">Normal</option>
                    <option value="reminder">Reminder (Herinnering)</option>
                    <option value="aanmaning">Aanmaning</option>
                    <option value="deurwaarder">Deurwaarder</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                    Initial Paid ({state.currency.symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={billPaidAmount}
                    onChange={(e) => setBillPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">IBAN (optional)</label>
                  <input
                    type="text"
                    value={billIban}
                    onChange={(e) => setBillIban(e.target.value)}
                    placeholder="NL00BANK..."
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Reference (optional)</label>
                  <input
                    type="text"
                    value={billRef}
                    onChange={(e) => setBillRef(e.target.value)}
                    placeholder="INV-9901"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono"
                  />
                </div>
              </div>

              {/* PDF / Photo Attachment */}
              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                  Invoice Picture or PDF (Auto-optimizes to PDF)
                </label>
                <input
                  ref={addModalFileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, false)}
                />
                {billPhoto ? (
                  <div className="p-3 rounded-xl bg-[#7C3AED]/5 border border-[#7C3AED]/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#7C3AED] text-white flex items-center justify-center flex-shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#2B2740] truncate">{billPhoto.name}</div>
                        <div className="text-[10px] text-[#2E9E71] font-bold flex items-center gap-1">
                          <CheckCircle2 size={10} /> Converted to PDF
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBillPhoto(null)}
                      className="text-xs font-bold text-[#E5484D] hover:underline flex-shrink-0 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addModalFileInputRef.current?.click()}
                    className="w-full p-3 rounded-xl border border-dashed border-black/20 text-xs font-bold text-[#7C3AED] hover:bg-[#7C3AED]/5 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText size={14} />
                    <span>+ Take Picture or Attach PDF (Auto-Converts)</span>
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="e.g. Monthly instalment 1 of 3"
                  className="w-full p-2.5 rounded-xl border border-black/10 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddBill}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
              >
                Save Bill
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-3 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FULL BILL DETAIL / PARTIAL PAYMENTS / DOCUMENT VIEWER */}
      {/* ========================================================================= */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] p-6 max-w-lg w-full shadow-2xl border border-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Hidden file input for updating doc in detail view */}
            <input
              ref={detailFileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFileUpload(e, true)}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-[#2B2740]">{selectedBill.name}</h3>
                <div className="text-xs text-[#2B2740]/50 flex items-center gap-1.5 mt-0.5">
                  <Calendar size={13} /> Due: {selectedBill.due}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedBill(null);
                  setIsEditingDetails(false);
                }}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740] hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Status Banner */}
            {(() => {
              const status = getBillStatus(selectedBill);
              const rem = getBillRemaining(selectedBill);
              let bannerCls = "bg-[#7C3AED]/10 text-[#7C3AED]";
              let bannerText = `Unpaid — Due ${selectedBill.due}`;

              if (status === "paid") {
                bannerCls = "bg-emerald-500/15 text-[#2E9E71]";
                bannerText = "Paid in full";
              } else if (status === "partial") {
                bannerCls = "bg-amber-400/20 text-[#B0740E]";
                bannerText = `Partially paid — ${formatCurrency(rem, state.currency.symbol)} still owed`;
              } else if (isUrgent(selectedBill)) {
                bannerCls = "bg-[#E5484D]/15 text-[#E5484D]";
                bannerText = `Urgent — Due was ${selectedBill.due}`;
              }

              return (
                <div className={`p-3 rounded-2xl flex items-center justify-between font-bold text-xs ${bannerCls}`}>
                  <span>{bannerText}</span>
                  <button
                    onClick={() => handleTogglePaid(selectedBill)}
                    className="px-3 py-1 rounded-lg bg-white shadow-xs text-[#2B2740] text-xs hover:bg-black/5 font-semibold"
                  >
                    {status === "paid" ? "Mark Unpaid" : "Mark as Paid"}
                  </button>
                </div>
              );
            })()}

            {/* Financial Overview Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                <div className="text-[10px] font-bold text-[#2B2740]/50 uppercase">Total Bill</div>
                <div className="text-sm font-extrabold font-mono text-[#2B2740] mt-0.5">
                  {formatCurrency(selectedBill.amount, state.currency.symbol)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                <div className="text-[10px] font-bold text-[#2B2740]/50 uppercase">Paid So Far</div>
                <div className="text-sm font-extrabold font-mono text-[#2E9E71] mt-0.5">
                  {formatCurrency(getBillPaidAmount(selectedBill), state.currency.symbol)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                <div className="text-[10px] font-bold text-[#2B2740]/50 uppercase">Remaining</div>
                <div className="text-sm font-extrabold font-mono text-[#E5484D] mt-0.5">
                  {formatCurrency(getBillRemaining(selectedBill), state.currency.symbol)}
                </div>
              </div>
            </div>

            {/* IBAN & Reference Quick Copy */}
            {(selectedBill.iban || selectedBill.reference) && (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-2">
                {selectedBill.iban && (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#2B2740]/50 text-[11px] block">IBAN</span>
                      <span className="font-mono font-bold text-[#2B2740]">{selectedBill.iban}</span>
                    </div>
                    <button
                      onClick={() => handleCopyIban(selectedBill.iban!)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-black/10 text-xs font-bold text-[#7C3AED] hover:bg-[#7C3AED]/5 flex items-center gap-1"
                    >
                      {copiedIban ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedIban ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                )}
                {selectedBill.reference && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-black/[0.04]">
                    <div>
                      <span className="text-[#2B2740]/50 text-[11px] block">Payment Reference</span>
                      <span className="font-mono font-bold text-[#2B2740]">{selectedBill.reference}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attached Invoice PDF / Document Section */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2B2740]/70 flex items-center gap-1.5">
                  <FileText size={14} className="text-[#7C3AED]" />
                  <span>Invoice Document Scan</span>
                </span>
                <button
                  onClick={() => detailFileInputRef.current?.click()}
                  className="text-[11px] font-bold text-[#7C3AED] hover:underline"
                >
                  {selectedBill.photo ? "Replace PDF" : "+ Attach Invoice"}
                </button>
              </div>

              {selectedBill.photo ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-black/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center flex-shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#2B2740] truncate">{selectedBill.photo.name}</div>
                      <div className="text-[10px] text-[#2E9E71] font-bold">Optimized PDF Document</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleOpenPdf(selectedBill.photo!.data, selectedBill.photo!.name)}
                      className="px-2.5 py-1 rounded-lg bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D3AED] flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Open
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(selectedBill.photo!.data, selectedBill.photo!.name)}
                      className="px-2.5 py-1 rounded-lg bg-black/5 text-[#2B2740] text-xs font-bold hover:bg-black/10 flex items-center gap-1"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#2B2740]/40 text-center py-2">
                  No document attached. Tap "+ Attach Invoice" to upload a scan or photo.
                </div>
              )}
            </div>

            {/* Partial Payments Recording & Ledger */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-3">
              <div className="text-xs font-bold text-[#2B2740]/70 flex items-center gap-1.5">
                <CreditCard size={14} className="text-[#7C3AED]" />
                <span>Record Partial Payment</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Amount (€)"
                  className="w-32 p-2.5 rounded-xl border border-black/10 text-sm font-mono font-bold bg-white"
                />
                <input
                  type="text"
                  value={paymentBy}
                  onChange={(e) => setPaymentBy(e.target.value)}
                  placeholder="Payer name"
                  className="flex-1 p-2.5 rounded-xl border border-black/10 text-sm bg-white"
                />
                <button
                  onClick={handleAddPayment}
                  className="px-4 py-2.5 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-sm hover:bg-[#6D3AED] flex-shrink-0"
                >
                  Record
                </button>
              </div>

              {/* Payments History Ledger */}
              {selectedBill.payments && selectedBill.payments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-[#2B2740]/50">Payment History</div>
                  <div className="bg-white rounded-xl border border-black/10 divide-y divide-black/[0.04] overflow-hidden">
                    {selectedBill.payments.map((p) => (
                      <div key={p.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-[#2B2740]">
                            {formatCurrency(p.amount, state.currency.symbol)}
                          </span>
                          <span className="text-[#2B2740]/50 ml-1.5">by {p.paidBy || "Lisa"}</span>
                        </div>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="text-[#2B2740]/30 hover:text-[#E5484D] p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Edit Bill Details / Delete Footer */}
            {isEditingDetails ? (
              <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-3">
                <div className="text-xs font-bold text-[#2B2740]">Edit Bill Details</div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Bill Name"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white font-medium"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Amount (€)"
                      className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono font-bold bg-white"
                    />
                    <input
                      type="text"
                      value={editDue}
                      onChange={(e) => setEditDue(e.target.value)}
                      placeholder="Due Date"
                      className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editIban}
                      onChange={(e) => setEditIban(e.target.value)}
                      placeholder="IBAN"
                      className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white font-mono"
                    />
                    <input
                      type="text"
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                      placeholder="Reference"
                      className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white font-mono"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEditDetails}
                    className="px-4 py-2 rounded-xl bg-[#7C3AED] text-white font-bold text-xs"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingDetails(false)}
                    className="px-4 py-2 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setIsEditingDetails(true)}
                  className="text-xs font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
                >
                  <Edit3 size={13} /> Edit Bill
                </button>
                <button
                  onClick={() => handleDeleteBill(selectedBill.id)}
                  className="text-xs font-bold text-[#E5484D] hover:underline flex items-center gap-1"
                >
                  <Trash2 size={13} /> Delete Bill
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
