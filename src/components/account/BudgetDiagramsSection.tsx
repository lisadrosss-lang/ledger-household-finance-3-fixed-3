import React, { useState } from "react";
import { Account, BudgetCategory } from "../../types";
import { formatCurrency } from "../../lib/storage";
import { Plus, Trash2, Edit3, AlertCircle, CheckCircle2, TrendingUp, PieChart, BarChart3, Minus, X } from "lucide-react";

interface BudgetDiagramsSectionProps {
  account: Account;
  currencySymbol: string;
  onUpdateAccount: (updated: Account) => void;
  onShowToast: (msg: string) => void;
}

const CATEGORY_COLORS = [
  "#7C3AED",
  "#2E9E71",
  "#F5B94E",
  "#4FA8E3",
  "#B0459E",
  "#FF9B71",
  "#E5484D",
  "#3D5A80",
];

const PRESET_SUGGESTIONS = [
  "Groceries",
  "Dining & Cafes",
  "Shopping",
  "Transport & Fuel",
  "Health & Wellness",
  "Entertainment",
  "Travel & Holiday",
  "Personal Care",
];

export const BudgetDiagramsSection: React.FC<BudgetDiagramsSectionProps> = ({
  account,
  currencySymbol,
  onUpdateAccount,
  onShowToast,
}) => {
  const budgets = account.budgets || [];

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatBudget, setNewCatBudget] = useState("");
  const [newCatSpent, setNewCatSpent] = useState("");

  // Spend modal for quick logging
  const [activeSpendCat, setActiveSpendCat] = useState<BudgetCategory | null>(null);
  const [spendAmountInput, setSpendAmountInput] = useState("");
  const [isAddingSpend, setIsAddingSpend] = useState(true);

  // Overall totals
  const totalBudget = budgets.reduce((sum, b) => sum + b.budget, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = Math.max(0, totalBudget - totalSpent);
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const isOverallOverBudget = totalSpent > totalBudget && totalBudget > 0;

  // Donut Gauge calculations (circumference for radius 70)
  const radius = 64;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (Math.min(100, overallPct) / 100) * circumference;

  const handleAddCategory = () => {
    const budgetNum = parseFloat(newCatBudget);
    const spentNum = parseFloat(newCatSpent) || 0;
    if (!newCatName.trim() || isNaN(budgetNum) || budgetNum <= 0) {
      onShowToast("Please provide category name and positive budget");
      return;
    }
    const newCat: BudgetCategory = {
      id: Date.now(),
      name: newCatName.trim(),
      budget: budgetNum,
      spent: spentNum,
    };
    onUpdateAccount({
      ...account,
      budgets: [...budgets, newCat],
    });
    setNewCatName("");
    setNewCatBudget("");
    setNewCatSpent("");
    setShowAddModal(false);
    onShowToast(`Budget category "${newCat.name}" added`);
  };

  const handleDeleteCategory = (id: number) => {
    onUpdateAccount({
      ...account,
      budgets: budgets.filter((b) => b.id !== id),
    });
    onShowToast("Budget category removed");
  };

  const handleLogSpend = () => {
    if (!activeSpendCat) return;
    const amt = parseFloat(spendAmountInput);
    if (isNaN(amt) || amt <= 0) {
      onShowToast("Enter a valid amount");
      return;
    }
    const delta = isAddingSpend ? amt : -amt;
    onUpdateAccount({
      ...account,
      budgets: budgets.map((b) =>
        b.id === activeSpendCat.id
          ? { ...b, spent: Math.max(0, b.spent + delta) }
          : b
      ),
    });
    onShowToast(
      `${isAddingSpend ? "Added" : "Deducted"} ${formatCurrency(amt, currencySymbol)} ${
        isAddingSpend ? "to" : "from"
      } ${activeSpendCat.name}`
    );
    setActiveSpendCat(null);
    setSpendAmountInput("");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-[#2B2740]">Personal Budgeting & Visual Analytics</div>
          <div className="text-[11px] text-[#2B2740]/50">
            Interactive diagrams and real-time category spending meters
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D3AED] shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus size={15} />
          <span>New Budget</span>
        </button>
      </div>

      {budgets.length > 0 ? (
        <>
          {/* ========================================================================= */}
          {/* DIAGRAM 1: OVERALL BUDGET RADIAL / DONUT GAUGE */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-black/[0.04] space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold">
                  <PieChart size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#2B2740]">Overall Spending Gauge</div>
                  <div className="text-[11px] text-[#2B2740]/40">Cumulative budget vs actual spend</div>
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isOverallOverBudget
                    ? "bg-[#E5484D]/10 text-[#E5484D]"
                    : overallPct > 80
                    ? "bg-[#F5B94E]/15 text-[#B0740E]"
                    : "bg-[#2E9E71]/10 text-[#2E9E71]"
                }`}
              >
                {isOverallOverBudget ? "⚠️ Over Budget" : overallPct > 80 ? "⚡ Near Limit" : "✓ On Track"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
              {/* SVG Radial Chart */}
              <div className="relative flex items-center justify-center">
                <svg height={radius * 2} width={radius * 2} className="-rotate-90 transform">
                  {/* Background track */}
                  <circle
                    stroke="rgba(0,0,0,0.06)"
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                  />
                  {/* Active gauge track */}
                  <circle
                    stroke={
                      isOverallOverBudget
                        ? "#E5484D"
                        : overallPct > 85
                        ? "#F5B94E"
                        : "#7C3AED"
                    }
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                  />
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold font-mono text-[#2B2740]">
                    {overallPct.toFixed(0)}%
                  </span>
                  <span className="text-[10px] font-bold text-[#2B2740]/40 uppercase tracking-wider">
                    Spent
                  </span>
                </div>
              </div>

              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto flex-1">
                <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.04]">
                  <div className="text-[11px] font-bold text-[#2B2740]/50">Total Budget</div>
                  <div className="text-base font-extrabold font-mono text-[#2B2740] mt-0.5">
                    {formatCurrency(totalBudget, currencySymbol)}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.04]">
                  <div className="text-[11px] font-bold text-[#2B2740]/50">Total Spent</div>
                  <div
                    className={`text-base font-extrabold font-mono mt-0.5 ${
                      isOverallOverBudget ? "text-[#E5484D]" : "text-[#7C3AED]"
                    }`}
                  >
                    {formatCurrency(totalSpent, currencySymbol)}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.04] col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-[#2B2740]/50">
                      {isOverallOverBudget ? "Deficit / Overdraft" : "Remaining Allowance"}
                    </div>
                    <div
                      className={`text-base font-extrabold font-mono mt-0.5 ${
                        isOverallOverBudget ? "text-[#E5484D]" : "text-[#2E9E71]"
                      }`}
                    >
                      {isOverallOverBudget
                        ? `- ${formatCurrency(totalSpent - totalBudget, currencySymbol)}`
                        : formatCurrency(totalRemaining, currencySymbol)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[#2B2740]/40 font-medium">
                    {budgets.length} Categories
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DIAGRAM 2: BUDGET PROPORTION DISTRIBUTION BAR */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-black/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-[#2B2740]/70 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-[#7C3AED]" />
                <span>Budget Allocation Share</span>
              </div>
              <span className="text-[11px] text-[#2B2740]/40 font-mono">100% capacity</span>
            </div>

            {/* Stacked Proportional Bar */}
            <div className="h-4 rounded-xl bg-black/5 overflow-hidden flex shadow-inner">
              {budgets.map((b, i) => {
                const share = totalBudget > 0 ? (b.budget / totalBudget) * 100 : 0;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <div
                    key={b.id}
                    style={{ width: `${share}%`, backgroundColor: color }}
                    className="h-full transition-all duration-300 relative group cursor-pointer"
                    title={`${b.name}: ${share.toFixed(1)}% (${formatCurrency(b.budget, currencySymbol)})`}
                  />
                );
              })}
            </div>

            {/* Legend Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {budgets.map((b, i) => {
                const share = totalBudget > 0 ? (b.budget / totalBudget) * 100 : 0;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <div
                    key={b.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.03] text-[11px] font-medium text-[#2B2740]"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-semibold">{b.name}</span>
                    <span className="font-mono text-[#2B2740]/50 text-[10px] font-bold">
                      {share.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DIAGRAM 3: CATEGORY SPEND VS BUDGET COMPARATIVE BARS */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-[#2B2740]/70">Category Comparative Spend</div>
              <span className="text-[11px] text-[#2B2740]/40">Tap '+ Spend' to log expense</span>
            </div>

            <div className="space-y-3">
              {budgets.map((b, idx) => {
                const pct = b.budget > 0 ? (b.spent / b.budget) * 100 : 0;
                const isOver = b.spent > b.budget;
                const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-[22px] p-4.5 shadow-sm border border-black/[0.04] space-y-3 hover:border-black/10 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div>
                          <div className="font-extrabold text-sm text-[#2B2740]">{b.name}</div>
                          <div className="text-[11px] text-[#2B2740]/50 font-mono">
                            Target: {formatCurrency(b.budget, currencySymbol)} / month
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-extrabold text-sm text-[#2B2740]">
                          <span className={isOver ? "text-[#E5484D]" : "text-[#2B2740]"}>
                            {formatCurrency(b.spent, currencySymbol)}
                          </span>
                          <span className="text-[#2B2740]/40 font-normal text-xs ml-1">
                            / {formatCurrency(b.budget, currencySymbol)}
                          </span>
                        </div>
                        <span
                          className={`text-[10.5px] font-bold font-mono px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                            isOver
                              ? "bg-[#E5484D]/10 text-[#E5484D]"
                              : pct > 80
                              ? "bg-[#F5B94E]/15 text-[#B0740E]"
                              : "bg-[#2E9E71]/10 text-[#2E9E71]"
                          }`}
                        >
                          {pct.toFixed(0)}% {isOver ? "OVER" : "used"}
                        </span>
                      </div>
                    </div>

                    {/* Comparative Bar Track */}
                    <div className="space-y-1">
                      <div className="h-3 rounded-full bg-black/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOver
                              ? "bg-[#E5484D]"
                              : pct > 80
                              ? "bg-[#F5B94E]"
                              : "bg-gradient-to-r from-[#7C3AED] to-[#5FD3A3]"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-[#2B2740]/50 font-medium">
                        <span>
                          {isOver
                            ? `Over budget by ${formatCurrency(b.spent - b.budget, currencySymbol)}`
                            : `${formatCurrency(b.budget - b.spent, currencySymbol)} left`}
                        </span>
                        <span>{pct.toFixed(0)}% committed</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.04]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setActiveSpendCat(b);
                            setIsAddingSpend(true);
                            setSpendAmountInput("");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-bold hover:bg-[#7C3AED]/20 transition-all flex items-center gap-1 active:scale-95"
                        >
                          <Plus size={13} /> + Spend
                        </button>
                        <button
                          onClick={() => {
                            setActiveSpendCat(b);
                            setIsAddingSpend(false);
                            setSpendAmountInput("");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-black/5 text-[#2B2740]/70 text-xs font-bold hover:bg-black/10 transition-all flex items-center gap-1 active:scale-95"
                        >
                          <Minus size={13} /> Adjust
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteCategory(b.id)}
                        className="p-1.5 text-[#2B2740]/30 hover:text-[#E5484D] transition-colors rounded-lg"
                        title="Delete category"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[22px] p-8 text-center text-xs text-[#2B2740]/50 border border-black/[0.04] space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mx-auto text-2xl shadow-inner">
            📊
          </div>
          <div>
            <div className="text-sm font-bold text-[#2B2740]">No budget diagrams yet</div>
            <p className="text-[11px] text-[#2B2740]/50 mt-0.5">
              Create your spending categories to visualize donut gauges, comparative bars, and proportion charts.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-[#7C3AED] text-white font-bold text-xs shadow-sm hover:bg-[#6D3AED]"
          >
            + Create First Budget Category
          </button>
        </div>
      )}

      {/* MODAL: ADD BUDGET CATEGORY */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">New Budget Category</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740] hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Groceries, Dining, Transport"
                  className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-medium focus:outline-none focus:border-[#7C3AED]"
                />
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-bold text-[#2B2740]/50 block mb-1.5">Quick Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SUGGESTIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewCatName(preset)}
                      className="px-2.5 py-1 rounded-lg bg-black/[0.04] text-[11px] font-medium text-[#2B2740] hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                    Monthly Target ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCatBudget}
                    onChange={(e) => setNewCatBudget(e.target.value)}
                    placeholder="300.00"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                    Initial Spent ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCatSpent}
                    onChange={(e) => setNewCatSpent(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddCategory}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
              >
                Add Category
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

      {/* MODAL: LOG OR ADJUST SPEND */}
      {activeSpendCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-black/[0.08] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">
                {isAddingSpend ? `Log Expense to ${activeSpendCat.name}` : `Adjust ${activeSpendCat.name}`}
              </h3>
              <button
                onClick={() => setActiveSpendCat(null)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740] hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-[#2B2740]/60">
                Current spent: <strong className="font-mono">{formatCurrency(activeSpendCat.spent, currencySymbol)}</strong> of{" "}
                <strong className="font-mono">{formatCurrency(activeSpendCat.budget, currencySymbol)}</strong>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                  Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={spendAmountInput}
                  onChange={(e) => setSpendAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 rounded-xl border border-black/10 text-base font-mono font-bold focus:outline-none focus:border-[#7C3AED]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleLogSpend}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
              >
                Confirm {isAddingSpend ? "Expense" : "Adjustment"}
              </button>
              <button
                type="button"
                onClick={() => setActiveSpendCat(null)}
                className="px-4 py-3 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
