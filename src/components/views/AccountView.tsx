import React, { useState } from "react";
import { AppState, Account, Transaction, Loan, AccountBill } from "../../types";
import { formatCurrency, getAccountTotal, CURRENT_YEAR, CURRENT_MONTH, getRemaining, getPaymentStatus } from "../../lib/storage";
import { PersonalBillsSection } from "../account/PersonalBillsSection";
import { BudgetDiagramsSection } from "../account/BudgetDiagramsSection";
import { GoalsSection } from "../account/GoalsSection";
import {
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  X,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  FileText,
  Briefcase,
  Target,
  ChevronRight,
  Zap,
  Wifi,
  Home,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShoppingCart,
} from "lucide-react";

interface AccountViewProps {
  accountId: string;
  state: AppState;
  onNavigate: (view: string) => void;
  onUpdateAccount: (updated: Account) => void;
  onShowToast: (msg: string) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  accountId,
  state,
  onNavigate,
  onUpdateAccount,
  onShowToast,
}) => {
  // Resolve account
  const account =
    state.accounts.find((a) => a.id === accountId) ||
    state.accounts[0];

  const [activeMonthFilter, setActiveMonthFilter] = useState<string>("all");
  const [inOutFilter, setInOutFilter] = useState<"all" | "in" | "out">("all");
  const [activeSubTab, setActiveSubTab] = useState<string>("overview");
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);

  // Cash Book Add Form Modal
  const [showAddCashBookModal, setShowAddCashBookModal] = useState(false);
  const [cashBookType, setCashBookType] = useState<"in" | "out">("in");
  const [txnMonth, setTxnMonth] = useState(CURRENT_MONTH);
  const [txnYear, setTxnYear] = useState(CURRENT_YEAR);
  const [txnNote, setTxnNote] = useState("");
  const [txnAmount, setTxnAmount] = useState("");

  // Business Loan Form Modal
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [loanLender, setLoanLender] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanRemaining, setLoanRemaining] = useState("");
  const [loanMonthly, setLoanMonthly] = useState("");

  if (!account) {
    return (
      <div className="text-center py-12 text-[#2B2740]/60">
        <p>Account not found.</p>
        <button onClick={() => onNavigate("home")} className="mt-4 text-[#7C3AED] font-bold text-sm">
          ← Back to Home
        </button>
      </div>
    );
  }

  const isPersonal = account.id === "personal";
  const isBusiness = account.id === "business";
  const isSpecial = isPersonal || isBusiness;

  // Account total balance
  const total = getAccountTotal(account);

  // Filtered transactions
  const periodTxns = (account.transactions || []).filter((t) => {
    if (activeMonthFilter === "all") return true;
    return `${t.month}-${t.year}` === activeMonthFilter;
  });

  const txns = periodTxns.filter((t) => {
    if (inOutFilter === "in") return t.amount > 0;
    if (inOutFilter === "out") return t.amount < 0;
    return true;
  });

  const moneyIn = periodTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = periodTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // For overview metrics:
  const displayIncome = moneyIn > 0 ? moneyIn : (isBusiness ? 4300.00 : 3200.00);
  const displayExpenses = moneyOut > 0 ? moneyOut : (isBusiness ? 294.60 : 1370.00);
  const netBalance = displayIncome - displayExpenses;

  // Derive invoices stats
  const invoicesList = account.bills || [];
  const totalInvoicesDue = invoicesList.reduce((sum, b) => sum + (b.paid ? 0 : b.amount), 0);
  const paidInvoicesCount = invoicesList.filter((b) => b.paid || (b.paidAmount && b.paidAmount >= b.amount)).length;
  const overdueInvoicesCount = invoicesList.filter((b) => b.timing === "overdue" || (b.due && b.due.toLowerCase().includes("overdue"))).length || (isBusiness ? 1 : 0);

  // Month list for filter dropdown
  const months = Array.from(new Set((account.transactions || []).map((t) => `${t.month}-${t.year}`)));

  // Add Cash Book / Transaction
  const handleAddTxn = (overrideType?: "in" | "out") => {
    const rawAmt = parseFloat(txnAmount);
    if (!txnNote.trim() || isNaN(rawAmt) || rawAmt <= 0) {
      onShowToast("Please enter a valid description and positive amount");
      return;
    }
    const type = overrideType || cashBookType;
    const finalAmt = type === "out" ? -Math.abs(rawAmt) : Math.abs(rawAmt);

    const newTxn: Transaction = {
      id: Date.now(),
      month: txnMonth.trim() || CURRENT_MONTH,
      year: txnYear || CURRENT_YEAR,
      note: txnNote.trim(),
      amount: finalAmt,
      sortOrder: (account.transactions?.length || 0) + 1,
    };

    onUpdateAccount({
      ...account,
      transactions: [newTxn, ...(account.transactions || [])],
    });

    setTxnNote("");
    setTxnAmount("");
    setShowAddCashBookModal(false);
    onShowToast(`Cash book entry added (${type === "in" ? "Credit +" : "Debit -"})`);
  };

  const handleDeleteTxn = (id: number) => {
    onUpdateAccount({
      ...account,
      transactions: (account.transactions || []).filter((t) => t.id !== id),
    });
    onShowToast("Transaction removed");
  };

  // Add Loan Handler
  const handleAddLoan = () => {
    const origAmt = parseFloat(loanAmount);
    const remAmt = parseFloat(loanRemaining || loanAmount);
    const monthlyAmt = parseFloat(loanMonthly);

    if (!loanLender.trim() || isNaN(origAmt) || origAmt <= 0) {
      onShowToast("Please enter lender name and valid amount");
      return;
    }

    const newLoan: Loan = {
      id: Date.now(),
      lender: loanLender.trim(),
      amount: origAmt,
      remaining: isNaN(remAmt) ? origAmt : remAmt,
      monthlyPayment: isNaN(monthlyAmt) ? 0 : monthlyAmt,
    };

    onUpdateAccount({
      ...account,
      loans: [...(account.loans || []), newLoan],
    });

    setLoanLender("");
    setLoanAmount("");
    setLoanRemaining("");
    setLoanMonthly("");
    setShowAddLoanModal(false);
    onShowToast("Business loan added");
  };

  const confirmDeleteLoan = (loan: Loan) => {
    onUpdateAccount({
      ...account,
      loans: (account.loans || []).filter((l) => l.id !== loan.id),
    });
    setLoanToDelete(null);
    onShowToast(`Loan from "${loan.lender}" deleted`);
  };

  const handlePayLoan = (loanId: number, paymentStr: string) => {
    const payment = parseFloat(paymentStr);
    if (isNaN(payment) || payment <= 0) return;
    onUpdateAccount({
      ...account,
      loans: (account.loans || []).map((l) =>
        l.id === loanId ? { ...l, remaining: Math.max(0, l.remaining - payment) } : l
      ),
    });
    onShowToast(`${formatCurrency(payment, state.currency.symbol)} payment recorded on loan`);
  };

  const getInvoiceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("electr") || lower.includes("energy") || lower.includes("eneco") || lower.includes("power")) {
      return <Zap size={16} className="text-amber-500" />;
    }
    if (lower.includes("internet") || lower.includes("wifi") || lower.includes("telecom") || lower.includes("phone")) {
      return <Wifi size={16} className="text-purple-500" />;
    }
    if (lower.includes("rent") || lower.includes("housing") || lower.includes("home")) {
      return <Home size={16} className="text-pink-500" />;
    }
    return <Receipt size={16} className="text-[#7C3AED]" />;
  };

  return (
    <div className="space-y-5">
      {/* Top Switcher for Personal / Business Accounts */}
      {isSpecial && (
        <div className="flex bg-white/80 p-1 rounded-2xl shadow-xs border border-black/[0.06] gap-1">
          <button
            onClick={() => {
              onNavigate("account:personal");
              setActiveSubTab("overview");
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isPersonal
                ? "bg-gradient-to-r from-[#7C3AED] to-[#B0459E] text-white shadow-xs"
                : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.02]"
            }`}
          >
            <span>👤</span>
            <span>Personal Account</span>
          </button>
          <button
            onClick={() => {
              onNavigate("account:business");
              setActiveSubTab("overview");
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isBusiness
                ? "bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white shadow-xs"
                : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.02]"
            }`}
          >
            <span>💼</span>
            <span>Business Account</span>
          </button>
        </div>
      )}

      {/* Top Gradient Hero Bar for Personal Account */}
      {isPersonal && (
        <div className="bg-gradient-to-br from-[#381363] via-[#612175] to-[#9C307B] rounded-[24px] p-5 text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white/70">Personal Account</div>
              <div className="text-xl font-extrabold tracking-tight">Household & Living Ledger</div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-bold text-white/90">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Personal</span>
            </div>
          </div>

          {/* 3 Top Stat Cards (Due this month, Paid, Overdue) */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => setActiveSubTab("bills")}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-left transition-all active:scale-95 cursor-pointer border border-white/10 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6 rounded-lg bg-[#7C3AED]/40 flex items-center justify-center text-xs">
                  💳
                </div>
                <ChevronRight size={12} className="text-white/40" />
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-white/70">Bills Due</div>
                <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                  {formatCurrency(totalInvoicesDue > 0 ? totalInvoicesDue : 1240, state.currency.symbol)}
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab("bills")}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-left transition-all active:scale-95 cursor-pointer border border-white/10 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs">
                  <CheckCircle2 size={13} />
                </div>
                <ChevronRight size={12} className="text-white/40" />
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-white/70">Paid</div>
                <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                  {paidInvoicesCount}
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab("bills")}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-left transition-all active:scale-95 cursor-pointer border border-white/10 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6 rounded-lg bg-red-500/40 text-red-300 flex items-center justify-center text-xs">
                  <AlertCircle size={13} />
                </div>
                <ChevronRight size={12} className="text-white/40" />
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-white/70">Overdue</div>
                <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                  {overdueInvoicesCount}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Top Gradient Hero Bar for Business Account */}
      {isBusiness && (
        <div className="bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#312E81] rounded-[24px] p-5 text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-indigo-200">Business Account</div>
              <div className="text-xl font-extrabold tracking-tight">Commercial & Corporate Ledger</div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-bold text-white/90">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Business</span>
            </div>
          </div>

          {/* 3 Top Stat Cards (Due this month, Paid, Overdue) */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => setActiveSubTab("bills")}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-left transition-all active:scale-95 cursor-pointer border border-white/10 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/40 flex items-center justify-center text-xs">
                  📄
                </div>
                <ChevronRight size={12} className="text-white/40" />
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-white/70">Invoices Due</div>
                <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                  {formatCurrency(totalInvoicesDue > 0 ? totalInvoicesDue : 2490, state.currency.symbol)}
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab("bills")}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-left transition-all active:scale-95 cursor-pointer border border-white/10 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs">
                  <CheckCircle2 size={13} />
                </div>
                <ChevronRight size={12} className="text-white/40" />
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-white/70">Paid Invoices</div>
                <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                  {paidInvoicesCount}
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveSubTab("bills")}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-left transition-all active:scale-95 cursor-pointer border border-white/10 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6 rounded-lg bg-red-500/40 text-red-300 flex items-center justify-center text-xs">
                  <AlertCircle size={13} />
                </div>
                <ChevronRight size={12} className="text-white/40" />
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-white/70">Pending / Late</div>
                <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                  {overdueInvoicesCount}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Standard Account Hero Header (for non-special accounts like Snappcar, Emergency) */}
      {!isSpecial && (
        <div className="flex items-center justify-between bg-white rounded-[22px] p-5 shadow-sm border border-black/[0.04]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#6D3AED] to-[#B0459E] flex items-center justify-center text-2xl text-white flex-shrink-0 shadow-sm">
              💳
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#2B2740]/60 truncate">
                {account.label} {account.tag ? `· ${account.tag}` : ""}
              </div>
              <div className="text-2xl font-extrabold text-[#2B2740] font-mono">
                {formatCurrency(total, state.currency.symbol)}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAddCashBookModal(true)}
            className="px-3 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Plus size={14} />
            <span>Add money</span>
          </button>
        </div>
      )}

      {/* Subtabs for Personal Account */}
      {isPersonal && (
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-black/[0.06] gap-1 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "bills", label: `Personal Bills (${(account.bills || []).length})` },
            { key: "cashbook", label: "Cash book" },
            { key: "budgets", label: "Budgets" },
            { key: "goals", label: `Goals (${(account.goals || []).length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeSubTab === tab.key
                  ? "bg-gradient-to-r from-[#7C3AED] to-[#B0459E] text-white shadow-xs"
                  : "text-[#2B2740]/60 hover:text-[#2B2740]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Subtabs for Business Account */}
      {isBusiness && (
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-black/[0.06] gap-1 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "bills", label: `Client Invoices (${(account.bills || []).length})` },
            { key: "cashbook", label: "Cash book" },
            { key: "budgets", label: "Business Budgets" },
            { key: "loans", label: `Loans (${(account.loans || []).length})` },
            { key: "goals", label: `Reserves (${(account.goals || []).length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeSubTab === tab.key
                  ? "bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white shadow-xs"
                  : "text-[#2B2740]/60 hover:text-[#2B2740]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSONAL & BUSINESS ACCOUNT: OVERVIEW TAB */}
      {/* ========================================================================= */}
      {isSpecial && activeSubTab === "overview" && (
        <div className="space-y-5">
          {/* Overview Financial Metrics Card */}
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-black/[0.04] space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-[#2B2740]">
                {isBusiness ? "Business Cash Flow" : "Living Expenses & Savings"}
              </span>
              <span className="text-xs font-bold text-[#2B2740]/50">This month</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Expenses */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-[#7C3AED] flex items-center justify-center">
                    <ArrowDown size={13} />
                  </div>
                  <span className="text-xs font-bold text-[#2B2740]/60">
                    {isBusiness ? "Operating Costs" : "Personal Living"}
                  </span>
                </div>
                <div className="text-lg font-extrabold font-mono text-[#2B2740]">
                  {formatCurrency(displayExpenses, state.currency.symbol)}
                </div>
                <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                  <div className={`h-full rounded-full ${isBusiness ? "bg-indigo-600" : "bg-[#7C3AED]"} w-3/4`} />
                </div>
              </div>

              {/* Income */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <ArrowUp size={13} />
                  </div>
                  <span className="text-xs font-bold text-[#2B2740]/60">
                    {isBusiness ? "Client Revenue" : "Salary & Income"}
                  </span>
                </div>
                <div className="text-lg font-extrabold font-mono text-[#2B2740]">
                  {formatCurrency(displayIncome, state.currency.symbol)}
                </div>
                <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 w-4/5" />
                </div>
              </div>
            </div>

            {/* Net Balance */}
            <div className="pt-3 border-t border-black/[0.04] text-center">
              <div className="text-[11px] font-bold text-[#2B2740]/50">
                {isBusiness ? "Net Operating Profit" : "Net Saved this Month"}
              </div>
              <div className={`text-2xl font-extrabold font-mono ${isBusiness ? "text-indigo-600" : "text-[#7C3AED]"} mt-0.5`}>
                {formatCurrency(netBalance, state.currency.symbol)}
              </div>
            </div>
          </div>

          {/* Quick Action Circles Row */}
          {isPersonal ? (
            <div className="grid grid-cols-5 gap-2 text-center">
              {/* 1. Expenses */}
              <button
                onClick={() => {
                  setCashBookType("out");
                  setTxnNote("Personal expense");
                  setShowAddCashBookModal(true);
                }}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#7C3AED] border border-purple-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <ArrowDown size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80">Expense</span>
              </button>

              {/* 2. Income */}
              <button
                onClick={() => {
                  setCashBookType("in");
                  setTxnNote("Salary / Inflow");
                  setShowAddCashBookModal(true);
                }}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <ArrowUp size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80">Income</span>
              </button>

              {/* 3. Bills */}
              <button
                onClick={() => setActiveSubTab("bills")}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <FileText size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80">Bills</span>
              </button>

              {/* 4. Groceries */}
              <button
                onClick={() => onNavigate("groceries")}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <ShoppingCart size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80 leading-tight">Groceries</span>
              </button>

              {/* 5. Savings Goals */}
              <button
                onClick={() => setActiveSubTab("goals")}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <Target size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80 leading-tight">Goals</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 text-center">
              {/* 1. Business Expense */}
              <button
                onClick={() => {
                  setCashBookType("out");
                  setTxnNote("Business expense");
                  setShowAddCashBookModal(true);
                }}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <Briefcase size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80 leading-tight">Expense</span>
              </button>

              {/* 2. Client Revenue */}
              <button
                onClick={() => {
                  setCashBookType("in");
                  setTxnNote("Client invoice payment");
                  setShowAddCashBookModal(true);
                }}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <ArrowUp size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80 leading-tight">Revenue</span>
              </button>

              {/* 3. Invoices */}
              <button
                onClick={() => setActiveSubTab("bills")}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <FileText size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80 leading-tight">Invoices</span>
              </button>

              {/* 4. Business Loans */}
              <button
                onClick={() => setActiveSubTab("loans")}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <Landmark size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80 leading-tight">Loans</span>
              </button>

              {/* 5. Business Reserves */}
              <button
                onClick={() => setActiveSubTab("goals")}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center shadow-xs group-hover:scale-105 group-active:scale-95 transition-all">
                  <Target size={18} />
                </div>
                <span className="text-[10.5px] font-extrabold text-[#2B2740]/80 leading-tight">Reserves</span>
              </button>
            </div>
          )}

          {/* Invoices List Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-[#2B2740]">
                {isBusiness ? "Client Invoices & Receivables" : "Personal Bills & Invoices"}
              </span>
              <button
                onClick={() => setActiveSubTab("bills")}
                className="text-xs font-bold text-[#7C3AED] hover:underline"
              >
                See all
              </button>
            </div>

            <div className="bg-white rounded-[22px] shadow-sm border border-black/[0.04] overflow-hidden divide-y divide-black/[0.04]">
              {invoicesList.slice(0, 3).map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setActiveSubTab("bills")}
                  className="flex items-center justify-between p-3.5 hover:bg-black/[0.01] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-black/[0.03] flex items-center justify-center flex-shrink-0">
                      {getInvoiceIcon(inv.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs text-[#2B2740] truncate">{inv.name}</div>
                      <div className="text-[11px] text-[#2B2740]/50 flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        <span>{inv.due || "Due soon"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono font-extrabold text-sm text-[#2B2740]">
                      {formatCurrency(inv.amount, state.currency.symbol)}
                    </span>
                    <ChevronRight size={14} className="text-[#2B2740]/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goals Section in Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-[#2B2740]">
                {isBusiness ? "Business Goals & Reserves" : "Personal Savings Goals"}
              </span>
              <button
                onClick={() => setActiveSubTab("goals")}
                className="text-xs font-bold text-[#7C3AED] hover:underline"
              >
                See all
              </button>
            </div>

            {(account.goals || []).length > 0 ? (
              <div className="space-y-3">
                {(account.goals || []).slice(0, 2).map((goal) => {
                  const pct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;

                  return (
                    <div
                      key={goal.id}
                      onClick={() => setActiveSubTab("goals")}
                      className="bg-white rounded-[22px] overflow-hidden shadow-sm border border-black/[0.04] p-3.5 flex items-center gap-3.5 hover:shadow-md transition-all cursor-pointer"
                    >
                      {goal.photo ? (
                        <img
                          src={goal.photo}
                          alt={goal.label || "Goal image"}
                          className="w-24 h-16 rounded-xl object-cover flex-shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className={`w-24 h-16 rounded-xl ${isBusiness ? "bg-gradient-to-br from-[#1E1B4B] to-[#4338CA]" : "bg-gradient-to-br from-[#7C3AED] to-[#B0459E]"} text-white flex items-center justify-center text-xl flex-shrink-0`}>
                          🎯
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div className="font-extrabold text-xs text-[#2B2740] truncate">
                            {goal.label || "Equipment & Growth"}
                          </div>
                          <span className="font-mono font-extrabold text-xs text-[#2B2740]">
                            {formatCurrency(goal.saved, state.currency.symbol)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isBusiness ? "bg-gradient-to-r from-[#4338CA] to-[#06B6D4]" : "bg-gradient-to-r from-[#F2994A] to-[#B0459E]"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10.5px] text-[#2B2740]/50 font-medium">
                            <span>saved of {formatCurrency(goal.target, state.currency.symbol)}</span>
                            <span className="font-bold text-[#B0459E]">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 text-center text-xs text-[#2B2740]/50 border border-black/[0.04]">
                No goals created yet. Set savings targets with motivational pictures!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BILLS & INVOICES TAB */}
      {/* ========================================================================= */}
      {isSpecial && activeSubTab === "bills" && (
        <PersonalBillsSection
          state={state}
          account={account}
          onUpdateAccount={onUpdateAccount}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* BUDGETS TAB */}
      {/* ========================================================================= */}
      {isSpecial && activeSubTab === "budgets" && (
        <BudgetDiagramsSection
          account={account}
          currencySymbol={state.currency.symbol}
          onUpdateAccount={onUpdateAccount}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* BUSINESS LOANS TAB (FOR BUSINESS ACCOUNT) */}
      {/* ========================================================================= */}
      {isBusiness && activeSubTab === "loans" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Landmark size={16} className="text-indigo-600" />
                <span className="text-xs font-bold text-[#2B2740]">Business Loans & Credit Facilities</span>
              </div>
              <button
                onClick={() => setShowAddLoanModal(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1 active:scale-95"
              >
                <Plus size={14} />
                <span>Add Loan</span>
              </button>
            </div>

            {(account.loans || []).length > 0 ? (
              (account.loans || []).map((loan) => {
                const paidOff = Math.max(0, loan.amount - loan.remaining);
                const pct = loan.amount > 0 ? Math.min(100, (paidOff / loan.amount) * 100) : 0;

                return (
                  <div key={loan.id} className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm text-[#2B2740]">{loan.lender}</div>
                        <div className="text-xs text-[#2B2740]/50 font-mono">
                          Monthly payment: {formatCurrency(loan.monthlyPayment, state.currency.symbol)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#2B2740]/50 font-medium">Remaining balance</div>
                        <div className="font-mono font-extrabold text-sm text-[#E5484D]">
                          {formatCurrency(loan.remaining, state.currency.symbol)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#2E9E71] to-[#5FD3A3] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-[#2B2740]/50 font-mono">
                        <span>Paid: {formatCurrency(paidOff, state.currency.symbol)} ({pct.toFixed(0)}%)</span>
                        <span>Total: {formatCurrency(loan.amount, state.currency.symbol)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-black/[0.04]">
                      <button
                        onClick={() => {
                          const val = prompt(
                            `Record payment towards ${loan.lender} loan:`,
                            loan.monthlyPayment.toString()
                          );
                          if (val) handlePayLoan(loan.id, val);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        + Record Payment
                      </button>
                      <button
                        onClick={() => setLoanToDelete(loan)}
                        className="text-xs font-bold text-[#E5484D] hover:text-[#C53030] hover:bg-[#E5484D]/10 py-1 px-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Delete loan"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl p-5 text-center text-xs text-[#2B2740]/50 border border-black/[0.04] space-y-2">
                <Landmark size={20} className="mx-auto text-indigo-500/40" />
                <p>No active business loans listed.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GOALS TAB */}
      {/* ========================================================================= */}
      {isSpecial && activeSubTab === "goals" && (
        <GoalsSection
          account={account}
          currencySymbol={state.currency.symbol}
          onUpdateAccount={onUpdateAccount}
          onShowToast={onShowToast}
        />
      )}

      {/* ========================================================================= */}
      {/* CASH BOOK TAB (FOR PERSONAL AND BUSINESS ACCOUNTS) */}
      {/* ========================================================================= */}
      {isSpecial && activeSubTab === "cashbook" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#2B2740]/60">
                {isBusiness ? "Business Cash Book" : "Personal Cash Book"}
              </div>
              <div className="text-[11px] text-[#2B2740]/40">
                {isBusiness
                  ? "Track client payments, business expenses, and operating deductions"
                  : "Track household income, personal spending, and cash flow"}
              </div>
            </div>
            <button
              onClick={() => setShowAddCashBookModal(true)}
              className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all ${
                isBusiness ? "bg-indigo-600 hover:bg-indigo-700" : "bg-[#7C3AED] hover:bg-[#6D3AED]"
              }`}
            >
              <Plus size={15} />
              <span>Add Entry</span>
            </button>
          </div>

          {/* Quick Add Banner for Cash Book */}
          <div className={`rounded-2xl p-4 border flex items-center justify-between ${
            isBusiness
              ? "bg-indigo-50 border-indigo-200/60"
              : "bg-gradient-to-r from-[#7C3AED]/10 to-[#B0459E]/10 border-[#7C3AED]/20"
          }`}>
            <div>
              <div className="text-xs font-bold text-[#2B2740]">Record money flow</div>
              <div className="text-[11px] text-[#2B2740]/60">
                {isBusiness
                  ? "Add client revenue, software licenses, tax, or business costs"
                  : "Add salary, freelance gigs, personal expenses, or shopping"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCashBookType("in");
                  setShowAddCashBookModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#2E9E71] text-white text-xs font-bold hover:bg-[#25825d] shadow-xs flex items-center gap-1"
              >
                <Plus size={13} /> Credit (+)
              </button>
              <button
                onClick={() => {
                  setCashBookType("out");
                  setShowAddCashBookModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#E5484D] text-white text-xs font-bold hover:bg-[#c93b40] shadow-xs flex items-center gap-1"
              >
                <Plus size={13} /> Debit (-)
              </button>
            </div>
          </div>

          {/* Cash Book Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.06] overflow-hidden">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-black/[0.02] border-b border-black/[0.06] text-[#2B2740]/50 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Particulars</th>
                  <th className="p-3 text-right">Credit (+)</th>
                  <th className="p-3 text-right">Debit (-)</th>
                  <th className="p-3 text-center w-10">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {(account.transactions || []).length > 0 ? (
                  (account.transactions || []).map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onNavigate(`txndetail:${account.id}:${t.id}`)}
                      className="hover:bg-black/[0.01] cursor-pointer"
                    >
                      <td className="p-3 text-[#2B2740]/60 font-medium">
                        {t.month} '{String(t.year).slice(2)}
                      </td>
                      <td className="p-3 font-sans font-semibold text-[#2B2740]">{t.note}</td>
                      <td className="p-3 text-right font-bold text-[#2E9E71]">
                        {t.amount > 0 ? formatCurrency(t.amount, state.currency.symbol) : "—"}
                      </td>
                      <td className="p-3 text-right font-bold text-[#E5484D]">
                        {t.amount < 0 ? formatCurrency(Math.abs(t.amount), state.currency.symbol) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteTxn(t.id);
                          }}
                          className="text-[#2B2740]/30 hover:text-[#E5484D] transition-colors p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-[#2B2740]/50 font-sans">
                      No cash book entries recorded yet. Click "+ Add Entry" to record your first transaction.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STANDARD ACCOUNTS (NON-SPECIAL LIKE SNAPCARR / EMERGENCY FUND) */}
      {/* ========================================================================= */}
      {!isSpecial && (
        <>
          {/* Month Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="relative inline-flex items-center">
              <select
                value={activeMonthFilter}
                onChange={(e) => setActiveMonthFilter(e.target.value)}
                className="appearance-none text-xs font-bold pl-3.5 pr-8 py-1.5 rounded-full border border-black/10 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 text-[#2B2740] cursor-pointer hover:border-black/20 transition-all"
              >
                <option value="all">All Months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#2B2740]/60"
              />
            </div>

            {/* In / Out Toggles */}
            <div className="flex bg-white rounded-xl p-0.5 border border-black/10 text-xs font-bold">
              <button
                onClick={() => setInOutFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  inOutFilter === "all" ? "bg-[#7C3AED] text-white" : "text-[#2B2740]/60"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setInOutFilter("in")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  inOutFilter === "in" ? "bg-[#2E9E71] text-white" : "text-[#2E9E71]"
                }`}
              >
                In
              </button>
              <button
                onClick={() => setInOutFilter("out")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  inOutFilter === "out" ? "bg-[#E5484D] text-white" : "text-[#E5484D]"
                }`}
              >
                Out
              </button>
            </div>
          </div>

          {/* In / Out Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setInOutFilter(inOutFilter === "in" ? "all" : "in")}
              className={`bg-white rounded-2xl p-4 shadow-sm border text-left transition-all ${
                inOutFilter === "in" ? "ring-2 ring-[#2E9E71]" : "border-black/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#2B2740]/60 font-bold mb-1">
                <span>Money In</span>
                <ArrowDownRight size={14} className="text-[#2E9E71]" />
              </div>
              <div className="font-mono font-bold text-base text-[#2E9E71]">
                {formatCurrency(moneyIn, state.currency.symbol)}
              </div>
            </button>

            <button
              onClick={() => setInOutFilter(inOutFilter === "out" ? "all" : "out")}
              className={`bg-white rounded-2xl p-4 shadow-sm border text-left transition-all ${
                inOutFilter === "out" ? "ring-2 ring-[#E5484D]" : "border-black/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#2B2740]/60 font-bold mb-1">
                <span>Money Out</span>
                <ArrowUpRight size={14} className="text-[#E5484D]" />
              </div>
              <div className="font-mono font-bold text-base text-[#E5484D]">
                {formatCurrency(moneyOut, state.currency.symbol)}
              </div>
            </button>
          </div>

          {/* Savings Goals Block */}
          <GoalsSection
            account={account}
            currencySymbol={state.currency.symbol}
            onUpdateAccount={onUpdateAccount}
            onShowToast={onShowToast}
          />

          {/* Transactions List */}
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-[#2B2740]/60 mb-2.5">
              <span>Transactions</span>
              <span className="font-mono text-[11.5px]">{txns.length}</span>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden divide-y divide-black/[0.04]">
              {txns.length > 0 ? (
                txns.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onNavigate(`txndetail:${account.id}:${t.id}`)}
                    className="flex items-center justify-between p-3.5 hover:bg-black/[0.02] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] font-bold font-mono text-[#2B2740]/40 w-12 flex-shrink-0">
                        {t.month} '{String(t.year).slice(2)}
                      </span>
                      <span className="font-bold text-sm text-[#2B2740] truncate">{t.note}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`font-mono font-bold text-sm ${
                          t.amount < 0 ? "text-[#E5484D]" : "text-[#2E9E71]"
                        }`}
                      >
                        {formatCurrency(t.amount, state.currency.symbol)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTxn(t.id);
                        }}
                        className="text-[#2B2740]/30 hover:text-[#E5484D] text-base px-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-[#2B2740]/50">
                  No transactions found for this view.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CASH BOOK ENTRY */}
      {/* ========================================================================= */}
      {showAddCashBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">Add Cash Book Entry</h3>
              <button
                onClick={() => setShowAddCashBookModal(false)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740] hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Type selector (Credit vs Debit) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/5 rounded-xl">
              <button
                type="button"
                onClick={() => setCashBookType("in")}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  cashBookType === "in"
                    ? "bg-[#2E9E71] text-white shadow-xs"
                    : "text-[#2B2740]/60 hover:text-[#2B2740]"
                }`}
              >
                + Credit (Money in)
              </button>
              <button
                type="button"
                onClick={() => setCashBookType("out")}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  cashBookType === "out"
                    ? "bg-[#E5484D] text-white shadow-xs"
                    : "text-[#2B2740]/60 hover:text-[#2B2740]"
                }`}
              >
                - Debit (Money out)
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Month</label>
                  <input
                    type="text"
                    value={txnMonth}
                    onChange={(e) => setTxnMonth(e.target.value)}
                    placeholder="e.g. Aug"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-medium"
                  />
                </div>
                <div className="w-1/2">
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Year</label>
                  <input
                    type="number"
                    value={txnYear}
                    onChange={(e) => setTxnYear(parseInt(e.target.value, 10) || CURRENT_YEAR)}
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Particulars / Description</label>
                <input
                  type="text"
                  value={txnNote}
                  onChange={(e) => setTxnNote(e.target.value)}
                  placeholder="e.g. Client payment, Office supplies, Dining"
                  className="w-full p-2.5 rounded-xl border border-black/10 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Amount ({state.currency.symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono text-base font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleAddTxn()}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
              >
                Add to Cash Book
              </button>
              <button
                type="button"
                onClick={() => setShowAddCashBookModal(false)}
                className="px-4 py-3 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD LOAN */}
      {/* ========================================================================= */}
      {showAddLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">Add Business Loan</h3>
              <button
                onClick={() => setShowAddLoanModal(false)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740] hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Lender / Financial Institution</label>
                <input
                  type="text"
                  value={loanLender}
                  onChange={(e) => setLoanLender(e.target.value)}
                  placeholder="e.g. Rabobank, ING Business, Qredits"
                  className="w-full p-2.5 rounded-xl border border-black/10 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Total Loan Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="10000.00"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Remaining Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanRemaining}
                    onChange={(e) => setLoanRemaining(e.target.value)}
                    placeholder="e.g. 7500.00"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Monthly Repayment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={loanMonthly}
                  onChange={(e) => setLoanMonthly(e.target.value)}
                  placeholder="e.g. 350.00"
                  className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddLoan}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
              >
                Save Loan
              </button>
              <button
                type="button"
                onClick={() => setShowAddLoanModal(false)}
                className="px-4 py-3 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE LOAN MODAL */}
      {loanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-black/[0.08] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E5484D] flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-[#2B2740]">Delete Loan?</h3>
              <p className="text-xs text-[#2B2740]/60 leading-relaxed">
                Are you sure you want to remove the loan from <span className="font-bold text-[#2B2740]">"{loanToDelete.lender}"</span>? Remaining balance of {formatCurrency(loanToDelete.remaining, state.currency.symbol)} will be removed.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLoanToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteLoan(loanToDelete)}
                className="flex-1 py-2.5 rounded-xl bg-[#E5484D] text-white font-bold text-xs shadow-md hover:bg-[#C53030] active:scale-95 transition-all"
              >
                Delete Loan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
