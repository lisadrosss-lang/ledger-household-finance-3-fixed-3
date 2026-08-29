import React, { useState, useEffect } from "react";
import { AppState, MonthlyFeedbackData } from "../../types";
import { formatCurrency, CURRENT_MONTH, CURRENT_YEAR, monthOrder } from "../../lib/storage";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ShoppingBag,
  Receipt,
  PiggyBank,
  CheckSquare,
  Square,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  ShieldAlert,
  Award,
  Zap,
  Target,
  ArrowUpRight,
  ChevronLeft,
} from "lucide-react";

interface MonthlyFeedbackViewProps {
  state: AppState;
  onNavigate: (view: string) => void;
  onShowToast: (msg: string) => void;
}

export const MonthlyFeedbackView: React.FC<MonthlyFeedbackViewProps> = ({
  state,
  onNavigate,
  onShowToast,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<MonthlyFeedbackData | null>(null);
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});
  const [copiedReport, setCopiedReport] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "groceries" | "bills" | "savings">("overview");

  // Fetch feedback from server endpoint
  const fetchMonthlyFeedback = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/gemini/monthly-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          bills: state.bills,
          groceries: state.groceries,
          accounts: state.accounts,
          currencySymbol: state.currency.symbol,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setFeedback(resData.data);
      } else {
        onShowToast("Loaded local analysis.");
      }
    } catch (error) {
      console.error("Error fetching feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyFeedback();
  }, [selectedMonth, selectedYear]);

  const toggleAction = (idx: number) => {
    setCompletedActions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleCopyReport = async () => {
    if (!feedback) return;
    let text = `📊 ${feedback.monthTitle} (Score: ${feedback.overallScore}/100)\n`;
    text += `• ${feedback.executiveSummary}\n\n`;
    text += `🎯 Action Plan:\n`;
    feedback.actionPlan.forEach((a, i) => {
      text += `${i + 1}. [${a.priority.toUpperCase()}] ${a.title} (${a.impact})\n`;
    });

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedReport(true);
      onShowToast("Feedback summary copied!");
      setTimeout(() => setCopiedReport(false), 2000);
    } catch (e) {
      onShowToast("Failed to copy summary.");
    }
  };

  const getScoreTheme = (score: number) => {
    if (score >= 80) {
      return {
        badge: "bg-emerald-500 text-white",
        ring: "border-emerald-200 bg-emerald-50 text-emerald-700",
        label: "Excellent Pace",
        icon: "🌟",
      };
    }
    if (score >= 60) {
      return {
        badge: "bg-amber-500 text-white",
        ring: "border-amber-200 bg-amber-50 text-amber-700",
        label: "Good / On Track",
        icon: "⚡",
      };
    }
    return {
      badge: "bg-[#E5484D] text-white",
      ring: "border-red-200 bg-red-50 text-[#E5484D]",
      label: "Needs Attention",
      icon: "🚨",
    };
  };

  const currentBills = state.bills.filter((b) => !b.month || b.month === selectedMonth);
  const totalBillsAmt = currentBills.reduce((s, b) => s + b.amount, 0);
  const totalBillsPaid = currentBills.reduce((s, b) => s + b.paidAmount, 0);
  const billsPaidPct = totalBillsAmt > 0 ? Math.round((totalBillsPaid / totalBillsAmt) * 100) : 100;

  const groceryBudget = state.groceries.budget || 0;
  const groceryEntries = state.groceries.entries.filter((e) => !e.month || e.month === selectedMonth);
  const grocerySpent = groceryEntries.reduce((s, e) => s + e.amount, 0);
  const groceryBudgetPct = groceryBudget > 0 ? Math.min(100, Math.round((grocerySpent / groceryBudget) * 100)) : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header with Back to More Pages and Month Selector */}
      <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("hub")}
            className="w-8 h-8 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#2B2740] active:scale-95 transition-all"
            title="Back to More Pages"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#B0459E] flex items-center justify-center text-white shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#2B2740]">Monthly Feedback & Advice</h2>
              <div className="text-[11px] text-[#2B2740]/50">Visual ratings & key steps</div>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-1.5 px-2.5 rounded-xl border border-black/10 text-xs font-extrabold bg-white text-[#2B2740] shadow-xs cursor-pointer"
          >
            {monthOrder.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={fetchMonthlyFeedback}
            disabled={loading}
            className="p-1.5 px-2 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20 font-bold transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading && !feedback ? (
        <div className="bg-white rounded-[24px] p-8 text-center shadow-sm border border-black/[0.04] space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#7C3AED]/20 border-t-[#7C3AED] animate-spin mx-auto" />
          <div className="text-xs font-extrabold text-[#2B2740]">Evaluating month performance...</div>
        </div>
      ) : feedback ? (
        <div className="space-y-4">
          {/* 1. VISUAL SCORE BANNER (Icon & Badge Driven) */}
          {(() => {
            const theme = getScoreTheme(feedback.overallScore);
            return (
              <div className="bg-white rounded-[22px] p-4 shadow-sm border border-black/[0.06] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-mono font-black ${theme.ring}`}
                  >
                    <span className="text-2xl leading-none">{feedback.overallScore}</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold">/ 100</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${theme.badge}`}>
                        {theme.icon} {theme.label}
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-[#2B2740] mt-1 truncate max-w-[200px] sm:max-w-xs">
                      {selectedMonth} {selectedYear} Financial Standing
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCopyReport}
                  className="p-2 px-3 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] text-[#2B2740] text-xs font-bold flex items-center gap-1 transition-all"
                  title="Copy Quick Summary"
                >
                  {copiedReport ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span className="hidden sm:inline">{copiedReport ? "Copied" : "Copy"}</span>
                </button>
              </div>
            );
          })()}

          {/* 2. THREE COMPACT VISUAL STAT CARDS (Icons & Mini Progress Bars) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Bills Progress Card */}
            <div className="bg-white rounded-2xl p-3 shadow-xs border border-black/[0.06] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-[#2B2740]/60 uppercase">Bills</span>
                <Receipt size={14} className="text-[#7C3AED]" />
              </div>
              <div className="my-1.5">
                <div className="text-sm font-extrabold text-[#2B2740] font-mono">{billsPaidPct}%</div>
                <div className="w-full h-1.5 bg-black/[0.05] rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-[#7C3AED] rounded-full transition-all"
                    style={{ width: `${billsPaidPct}%` }}
                  />
                </div>
              </div>
              <span className="text-[9.5px] font-bold text-[#2B2740]/50 truncate">
                {formatCurrency(totalBillsPaid, state.currency.symbol)} paid
              </span>
            </div>

            {/* Groceries Card */}
            <div className="bg-white rounded-2xl p-3 shadow-xs border border-black/[0.06] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-[#2B2740]/60 uppercase">Groceries</span>
                <ShoppingBag size={14} className="text-[#B0459E]" />
              </div>
              <div className="my-1.5">
                <div className="text-sm font-extrabold text-[#2B2740] font-mono">
                  {groceryBudget > 0 ? `${groceryBudgetPct}%` : formatCurrency(grocerySpent, state.currency.symbol)}
                </div>
                <div className="w-full h-1.5 bg-black/[0.05] rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${
                      groceryBudgetPct > 90 ? "bg-[#E5484D]" : "bg-[#B0459E]"
                    }`}
                    style={{ width: `${Math.min(100, groceryBudgetPct)}%` }}
                  />
                </div>
              </div>
              <span className="text-[9.5px] font-bold text-[#2B2740]/50 truncate">
                {groceryBudget > 0 ? `of ${formatCurrency(groceryBudget, state.currency.symbol)}` : "Tracking"}
              </span>
            </div>

            {/* Health / Savings Status Card */}
            <div className="bg-white rounded-2xl p-3 shadow-xs border border-black/[0.06] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-[#2B2740]/60 uppercase">Health</span>
                <PiggyBank size={14} className="text-emerald-500" />
              </div>
              <div className="my-1.5">
                <div className="text-sm font-extrabold text-emerald-600 font-mono">
                  {feedback.overallScore >= 75 ? "Stable" : "Tight"}
                </div>
                <div className="w-full h-1.5 bg-black/[0.05] rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${feedback.overallScore}%` }}
                  />
                </div>
              </div>
              <span className="text-[9.5px] font-bold text-emerald-600 truncate">
                {feedback.overallScore >= 75 ? "✓ Buffer intact" : "⚠️ Review outflow"}
              </span>
            </div>
          </div>

          {/* 3. VISUAL HIGHLIGHT CHIPS (Less Text, Pure Icon Badges) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {feedback.keyHighlights.slice(0, 4).map((highlight, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-2.5 shadow-xs border border-black/[0.05] flex items-center gap-2.5 text-xs text-[#2B2740] font-semibold"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={14} />
                </div>
                <span className="truncate">{highlight}</span>
              </div>
            ))}
          </div>

          {/* 4. VISUAL TABS: ACTION PLAN / GROCERIES / BILLS / SAVINGS */}
          <div className="flex bg-black/[0.04] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1 ${
                activeTab === "overview" ? "bg-white text-[#7C3AED] shadow-xs" : "text-[#2B2740]/60"
              }`}
            >
              <Zap size={13} />
              <span>Actions ({feedback.actionPlan.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("groceries")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1 ${
                activeTab === "groceries" ? "bg-white text-[#7C3AED] shadow-xs" : "text-[#2B2740]/60"
              }`}
            >
              <ShoppingBag size={13} />
              <span>Groceries</span>
            </button>
            <button
              onClick={() => setActiveTab("bills")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1 ${
                activeTab === "bills" ? "bg-white text-[#7C3AED] shadow-xs" : "text-[#2B2740]/60"
              }`}
            >
              <Receipt size={13} />
              <span>Bills</span>
            </button>
            <button
              onClick={() => setActiveTab("savings")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1 ${
                activeTab === "savings" ? "bg-white text-[#7C3AED] shadow-xs" : "text-[#2B2740]/60"
              }`}
            >
              <PiggyBank size={13} />
              <span>Savings</span>
            </button>
          </div>

          {/* TAB 1: VISUAL ACTION CHECKLIST */}
          {activeTab === "overview" && (
            <div className="space-y-2">
              {feedback.actionPlan.map((action, idx) => {
                const isDone = !!completedActions[idx];
                const priorityIcon =
                  action.priority === "high" ? "🚨" : action.priority === "medium" ? "⚡" : "💡";

                return (
                  <div
                    key={idx}
                    onClick={() => toggleAction(idx)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isDone
                        ? "bg-emerald-50/60 border-emerald-200 opacity-60"
                        : "bg-white border-black/[0.06] hover:border-[#7C3AED]/40 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-[#7C3AED]">
                        {isDone ? (
                          <CheckCircle size={20} className="text-emerald-600" />
                        ) : (
                          <Square size={20} className="text-[#2B2740]/30" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{priorityIcon}</span>
                          <span
                            className={`text-xs font-extrabold text-[#2B2740] truncate ${
                              isDone ? "line-through text-[#2B2740]/50" : ""
                            }`}
                          >
                            {action.title}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] text-[#2B2740]/60 truncate ${
                            isDone ? "line-through text-[#2B2740]/40" : ""
                          }`}
                        >
                          {action.description}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <span className="text-[10px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {action.impact}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: GROCERIES FEEDBACK */}
          {activeTab === "groceries" && (
            <div className="space-y-2">
              <div className="bg-[#B0459E]/10 p-3.5 rounded-2xl border border-[#B0459E]/20 text-xs font-semibold text-[#2B2740] flex items-center justify-between">
                <span>🛒 {feedback.groceryInsights.observation}</span>
                <button
                  onClick={() => onNavigate("groceries")}
                  className="ml-2 text-xs font-bold text-[#B0459E] hover:underline flex items-center gap-0.5 flex-shrink-0"
                >
                  <span>Open</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {feedback.groceryInsights.shoppingPacingTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl p-2.5 shadow-xs border border-black/[0.05] flex items-center gap-2 text-xs font-medium text-[#2B2740]"
                  >
                    <span className="text-sm">💡</span>
                    <span className="truncate">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BILLS OPTIMIZATION */}
          {activeTab === "bills" && (
            <div className="space-y-2">
              <div className="bg-[#E5484D]/10 p-3.5 rounded-2xl border border-[#E5484D]/20 text-xs font-semibold text-[#2B2740] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert size={16} className="text-[#E5484D] flex-shrink-0" />
                  <span className="truncate">{feedback.billsOptimization.overdueRiskNote}</span>
                </div>
                <button
                  onClick={() => onNavigate("bills")}
                  className="ml-2 text-xs font-bold text-[#E5484D] hover:underline flex items-center gap-0.5 flex-shrink-0"
                >
                  <span>Bills</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {feedback.billsOptimization.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl p-2.5 shadow-xs border border-black/[0.05] flex items-center gap-2 text-xs font-medium text-[#2B2740]"
                  >
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span className="truncate">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SAVINGS TIPS */}
          {activeTab === "savings" && (
            <div className="space-y-2">
              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
                <PiggyBank size={16} className="text-emerald-600 flex-shrink-0" />
                <span>{feedback.savingsAndGoals.statusNote}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {feedback.savingsAndGoals.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl p-2.5 shadow-xs border border-black/[0.05] flex items-center gap-2 text-xs font-medium text-[#2B2740]"
                  >
                    <span className="text-emerald-600 font-bold">★</span>
                    <span className="truncate">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
