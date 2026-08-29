import React, { useState } from "react";
import { AppState, GroceriesState, GroceryEntry } from "../../types";
import { formatCurrency, periodKey, CURRENT_MONTH, CURRENT_YEAR, monthOrder } from "../../lib/storage";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  TrendingUp,
  Store,
  PieChart as PieIcon,
  BarChart2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Receipt,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";

interface GroceriesViewProps {
  state: AppState;
  onUpdateGroceries: (updated: GroceriesState) => void;
  onShowToast: (msg: string) => void;
  onNavigate?: (view: string) => void;
}

const STORE_COLORS = [
  "#7C3AED", // Royal Purple
  "#B0459E", // Berry Magenta
  "#F2994A", // Warm Amber
  "#10B981", // Emerald Green
  "#3B82F6", // Sky Blue
  "#EC4899", // Rose Pink
  "#6366F1", // Indigo
  "#14B8A6", // Teal
];

export const GroceriesView: React.FC<GroceriesViewProps> = ({
  state,
  onUpdateGroceries,
  onShowToast,
  onNavigate,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(state.groceries.budget.toString());
  const [diagramMode, setDiagramMode] = useState<"monthly" | "stores" | "trips">("monthly");

  const [tripMonth, setTripMonth] = useState(CURRENT_MONTH);
  const [tripYear, setTripYear] = useState(CURRENT_YEAR);
  const [tripNote, setTripNote] = useState("");
  const [tripAmount, setTripAmount] = useState("");

  const [activePeriodKey, setActivePeriodKey] = useState<string>("all");

  const entries = state.groceries.entries || [];

  // Periods calculation
  const periodMap: Record<string, { month: string; year: number; key: string }> = {};
  entries.forEach((e) => {
    const key = `${e.month}-${e.year}`;
    if (!periodMap[key]) {
      periodMap[key] = { month: e.month, year: e.year, key };
    }
  });

  const periodsDesc = Object.values(periodMap).sort(
    (a, b) => periodKey(b.year, b.month) - periodKey(a.year, a.month)
  );

  const activeIndex = activePeriodKey === "all" ? 0 : periodsDesc.findIndex((p) => p.key === activePeriodKey);
  const currentNavPeriod = periodsDesc[activeIndex >= 0 ? activeIndex : 0];

  const currentMonthEntries = entries.filter((e) => e.month === CURRENT_MONTH && e.year === CURRENT_YEAR);
  const currentMonthTotal = currentMonthEntries.reduce((s, e) => s + e.amount, 0);

  const thisYearEntries = entries.filter((e) => e.year === CURRENT_YEAR);
  const thisYearTotal = thisYearEntries.reduce((s, e) => s + e.amount, 0);
  const uniqueMonths = new Set(thisYearEntries.map((e) => e.month)).size || 1;
  const avgPerMonth = thisYearTotal / uniqueMonths;
  const avgPerTrip = currentMonthEntries.length > 0 ? currentMonthTotal / currentMonthEntries.length : 0;

  // Filter entries for list & current view
  const filteredEntries = entries
    .filter((e) => {
      if (!currentNavPeriod || activePeriodKey === "all") return true;
      return e.month === currentNavPeriod.month && e.year === currentNavPeriod.year;
    })
    .slice()
    .reverse();

  const displayedPurchases = showAllPurchases ? filteredEntries : filteredEntries.slice(0, 6);

  // 1. Prepare Monthly Diagram Data (Chronological order)
  const allMonthsAsc = Object.values(periodMap)
    .sort((a, b) => periodKey(a.year, a.month) - periodKey(b.year, b.month))
    .slice(-6); // last 6 months

  const monthlyChartData = allMonthsAsc.map((p) => {
    const pEntries = entries.filter((e) => e.month === p.month && e.year === p.year);
    const total = pEntries.reduce((s, e) => s + e.amount, 0);
    return {
      name: `${p.month.slice(0, 3)} '${String(p.year).slice(2)}`,
      fullName: `${p.month} ${p.year}`,
      month: p.month,
      year: p.year,
      spent: Number(total.toFixed(2)),
      budget: state.groceries.budget,
      trips: pEntries.length,
      isCurrent: p.month === CURRENT_MONTH && p.year === CURRENT_YEAR,
    };
  });

  // 2. Prepare Store Breakdown Data
  const targetEntriesForStores =
    activePeriodKey === "all"
      ? entries
      : entries.filter((e) => currentNavPeriod && e.month === currentNavPeriod.month && e.year === currentNavPeriod.year);

  const storeMap: Record<string, { name: string; amount: number; count: number }> = {};
  targetEntriesForStores.forEach((e) => {
    const rawName = e.note.split("—")[0].split("-")[0].trim() || "Other";
    if (!storeMap[rawName]) {
      storeMap[rawName] = { name: rawName, amount: 0, count: 0 };
    }
    storeMap[rawName].amount += e.amount;
    storeMap[rawName].count += 1;
  });

  const totalStoreSpent = Object.values(storeMap).reduce((s, item) => s + item.amount, 0);
  const storeChartData = Object.values(storeMap)
    .map((item) => ({
      name: item.name,
      value: Number(item.amount.toFixed(2)),
      count: item.count,
      pct: totalStoreSpent > 0 ? Math.round((item.amount / totalStoreSpent) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // 3. Trip flow area chart data
  const tripChartData = targetEntriesForStores.slice(-10).map((e, idx) => ({
    tripIndex: idx + 1,
    store: e.note,
    amount: Number(e.amount.toFixed(2)),
    date: `${e.month} ${e.year}`,
  }));

  const handleAddTrip = () => {
    const amt = parseFloat(tripAmount);
    if (!tripNote.trim() || isNaN(amt) || amt <= 0) {
      onShowToast("Please enter a store name and valid amount");
      return;
    }
    const newEntry: GroceryEntry = {
      id: Date.now(),
      month: tripMonth.trim() || CURRENT_MONTH,
      year: tripYear || CURRENT_YEAR,
      note: tripNote.trim(),
      amount: amt,
    };
    onUpdateGroceries({
      ...state.groceries,
      entries: [...entries, newEntry],
    });
    setTripNote("");
    setTripAmount("");
    setShowAddForm(false);
    onShowToast("Shopping trip added");
  };

  const handleDeleteEntry = (id: number) => {
    onUpdateGroceries({
      ...state.groceries,
      entries: entries.filter((e) => e.id !== id),
    });
    onShowToast("Trip removed");
  };

  const handleSaveBudget = () => {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val < 0) {
      onShowToast("Please enter a valid budget amount");
      return;
    }
    onUpdateGroceries({
      ...state.groceries,
      budget: val,
    });
    setEditingBudget(false);
    onShowToast("Budget updated");
  };

  // Group by year for history
  const byYear: Record<number, GroceryEntry[]> = {};
  entries.forEach((e) => {
    if (!byYear[e.year]) byYear[e.year] = [];
    byYear[e.year].push(e);
  });
  const yearsDesc = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  const budgetPct = state.groceries.budget > 0 ? (currentMonthTotal / state.groceries.budget) * 100 : 0;
  const isOverBudget = state.groceries.budget > 0 && currentMonthTotal > state.groceries.budget;
  const remainingBudget = Math.max(0, state.groceries.budget - currentMonthTotal);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#B0459E] flex items-center justify-center text-white shadow-xs">
              <ShoppingCart size={16} />
            </div>
            <h2 className="text-xl font-extrabold text-[#2B2740]">Groceries & Supermarkets</h2>
          </div>
          <p className="text-xs text-[#2B2740]/60 mt-1">
            Track shopping outflow, supermarket distribution diagrams, and monthly budget pacing
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onNavigate && (
            <button
              onClick={() => onNavigate("feedback")}
              className="px-3.5 py-2 rounded-xl bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 text-[#7C3AED] font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>AI Feedback</span>
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#B0459E] to-[#F2994A] text-white font-bold text-xs shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add Trip</span>
          </button>
        </div>
      </div>

      {/* Add Shopping Trip Form Modal/Card */}
      {showAddForm && (
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-[#7C3AED]/30 space-y-3.5 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
            <span className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider flex items-center gap-1.5">
              <Receipt size={14} />
              <span>Log a Grocery Purchase</span>
            </span>
            <button onClick={() => setShowAddForm(false)} className="text-xs text-[#2B2740]/40 hover:text-[#2B2740]">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-[#2B2740]/60 block mb-1">Month</label>
              <select
                value={tripMonth}
                onChange={(e) => setTripMonth(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-black/10 text-xs bg-white font-semibold text-[#2B2740]"
              >
                {monthOrder.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#2B2740]/60 block mb-1">Year</label>
              <input
                type="number"
                value={tripYear}
                onChange={(e) => setTripYear(parseInt(e.target.value, 10) || CURRENT_YEAR)}
                placeholder="Year"
                className="w-full p-2.5 rounded-xl border border-black/10 text-xs font-mono text-[#2B2740]"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-[#2B2740]/60 block mb-1">Store / Supermarket</label>
              <input
                type="text"
                value={tripNote}
                onChange={(e) => setTripNote(e.target.value)}
                placeholder="e.g. Albert Heijn, Lidl, Jumbo"
                className="w-full p-2.5 rounded-xl border border-black/10 text-xs text-[#2B2740]"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#2B2740]/60 block mb-1">
              Amount Spent ({state.currency.symbol})
            </label>
            <input
              type="number"
              step="0.01"
              value={tripAmount}
              onChange={(e) => setTripAmount(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 rounded-xl border border-black/10 text-base font-mono font-bold text-[#2B2740]"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddTrip}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#B0459E] text-white font-bold text-xs shadow-sm hover:opacity-95"
            >
              Save Purchase
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 rounded-xl bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* VISUALLY ENHANCED METRIC NUMBERS DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1: Spent This Month */}
        <div className="bg-white rounded-[22px] p-4 sm:p-5 shadow-xs border border-black/[0.05] relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
              {CURRENT_MONTH} Outflow
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center text-[#7C3AED]">
              <ShoppingCart size={14} />
            </div>
          </div>

          <div className="my-2">
            <div className="text-3xl font-black font-mono text-[#2B2740] tracking-tight">
              {formatCurrency(currentMonthTotal, state.currency.symbol)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#2B2740]/60 mt-1 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
              <span>{currentMonthEntries.length} shopping trip{currentMonthEntries.length === 1 ? "" : "s"} logged</span>
            </div>
          </div>
        </div>

        {/* Card 2: Budget Progress & Cap */}
        <div className="bg-white rounded-[22px] p-4 sm:p-5 shadow-xs border border-black/[0.05] relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#B0459E]">
              Monthly Budget
            </span>
            <button
              onClick={() => {
                setBudgetInput(state.groceries.budget.toString());
                setEditingBudget(true);
              }}
              className="text-[11px] font-bold text-[#7C3AED] hover:underline"
            >
              {state.groceries.budget > 0 ? "Edit" : "+ Set"}
            </button>
          </div>

          <div className="my-2">
            <div className="text-3xl font-black font-mono text-[#2B2740] tracking-tight">
              {formatCurrency(state.groceries.budget, state.currency.symbol)}
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-2 rounded-full bg-black/[0.06] mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverBudget ? "bg-[#E5484D]" : budgetPct > 80 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Yearly Average */}
        <div className="bg-white rounded-[22px] p-4 sm:p-5 shadow-xs border border-black/[0.05] relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#F2994A]">
              {CURRENT_YEAR} Monthly Avg
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#F2994A]/10 flex items-center justify-center text-[#F2994A]">
              <TrendingUp size={14} />
            </div>
          </div>

          <div className="my-2">
            <div className="text-3xl font-black font-mono text-[#2B2740] tracking-tight">
              {formatCurrency(avgPerMonth, state.currency.symbol)}
            </div>
            <div className="text-xs text-[#2B2740]/60 mt-1 font-medium">
              Total {CURRENT_YEAR}: <span className="font-mono font-bold text-[#2B2740]">{formatCurrency(thisYearTotal, state.currency.symbol)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Editor Inline */}
      {editingBudget && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#7C3AED]/30 space-y-3 animate-fadeIn">
          <div className="text-xs font-bold text-[#2B2740]/70">Set Monthly Grocery Budget Target</div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="flex-1 p-2.5 rounded-xl border border-black/10 text-sm font-mono text-[#2B2740] font-bold"
              placeholder="e.g. 450"
            />
            <button
              onClick={handleSaveBudget}
              className="px-5 py-2 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-sm hover:bg-[#6D3AED]"
            >
              Save Budget
            </button>
            <button
              onClick={() => setEditingBudget(false)}
              className="px-4 py-2 rounded-xl bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DIAGRAM SECTION */}
      <div className="bg-white rounded-[24px] p-5 shadow-sm border border-black/[0.05] space-y-4">
        {/* Diagram Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06]">
          <div>
            <div className="text-sm font-extrabold text-[#2B2740] flex items-center gap-2">
              <BarChart2 size={18} className="text-[#7C3AED]" />
              <span>Grocery Spending Diagram</span>
            </div>
            <div className="text-xs text-[#2B2740]/50 mt-0.5">
              Interactive visual analytics of grocery spending and supermarket distribution
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-black/[0.04] p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setDiagramMode("monthly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                diagramMode === "monthly"
                  ? "bg-white text-[#7C3AED] shadow-xs"
                  : "text-[#2B2740]/60 hover:text-[#2B2740]"
              }`}
            >
              <BarChart2 size={13} />
              <span>Monthly Trend</span>
            </button>
            <button
              onClick={() => setDiagramMode("stores")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                diagramMode === "stores"
                  ? "bg-white text-[#7C3AED] shadow-xs"
                  : "text-[#2B2740]/60 hover:text-[#2B2740]"
              }`}
            >
              <PieIcon size={13} />
              <span>By Store</span>
            </button>
            <button
              onClick={() => setDiagramMode("trips")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                diagramMode === "trips"
                  ? "bg-white text-[#7C3AED] shadow-xs"
                  : "text-[#2B2740]/60 hover:text-[#2B2740]"
              }`}
            >
              <TrendingUp size={13} />
              <span>Trip Flow</span>
            </button>
          </div>
        </div>

        {/* Diagram 1: Monthly Trend vs Budget */}
        {diagramMode === "monthly" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#2B2740]/60">Last 6 Months Outflow vs Budget Cap</span>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-[#7C3AED]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#7C3AED]" /> Monthly Spend
                </span>
                {state.groceries.budget > 0 && (
                  <span className="flex items-center gap-1 text-[#E5484D]">
                    <span className="w-2.5 h-0.5 bg-[#E5484D]" /> Budget ({formatCurrency(state.groceries.budget, state.currency.symbol)})
                  </span>
                )}
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#2B2740"
                    strokeOpacity={0.4}
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#2B2740"
                    strokeOpacity={0.3}
                    fontSize={10}
                    tickFormatter={(v) => `${state.currency.symbol}${v}`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const isOver = state.groceries.budget > 0 && data.spent > state.groceries.budget;
                        return (
                          <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-black/10 text-xs space-y-1">
                            <div className="font-extrabold text-[#2B2740]">{data.fullName}</div>
                            <div className="font-mono text-sm font-bold text-[#7C3AED]">
                              {formatCurrency(data.spent, state.currency.symbol)}
                            </div>
                            <div className="text-[10px] text-[#2B2740]/60">
                              {data.trips} store trip{data.trips === 1 ? "" : "s"}
                            </div>
                            {state.groceries.budget > 0 && (
                              <div className={`text-[10px] font-bold ${isOver ? "text-[#E5484D]" : "text-emerald-600"}`}>
                                {isOver
                                  ? `Over budget by ${formatCurrency(data.spent - state.groceries.budget, state.currency.symbol)}`
                                  : `${formatCurrency(state.groceries.budget - data.spent, state.currency.symbol)} under budget`}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {state.groceries.budget > 0 && (
                    <ReferenceLine
                      y={state.groceries.budget}
                      stroke="#E5484D"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={{
                        value: `Budget: ${formatCurrency(state.groceries.budget, state.currency.symbol)}`,
                        fill: "#E5484D",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                  )}
                  <Bar dataKey="spent" radius={[8, 8, 0, 0]} maxBarSize={44}>
                    {monthlyChartData.map((entry, index) => {
                      const isOver = state.groceries.budget > 0 && entry.spent > state.groceries.budget;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.isCurrent
                              ? isOver
                                ? "#E5484D"
                                : "url(#purpleGradient)"
                              : isOver
                              ? "#FCA5A5"
                              : "#DDD6FE"
                          }
                        />
                      );
                    })}
                  </Bar>
                  <defs>
                    <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C3AED" />
                      <stop offset="100%" stopColor="#B0459E" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Diagram 2: Store Breakdown (Pie / Donut Diagram) */}
        {diagramMode === "stores" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#2B2740]/60">
                Supermarket Spending Share ({activePeriodKey === "all" ? "All Time" : `${currentNavPeriod?.month} ${currentNavPeriod?.year}`})
              </span>
              <span className="text-[11px] font-mono text-[#7C3AED] font-bold">
                Total: {formatCurrency(totalStoreSpent, state.currency.symbol)}
              </span>
            </div>

            {storeChartData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-56 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={storeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {storeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STORE_COLORS[index % STORE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-black/10 text-xs">
                                <div className="font-extrabold text-[#2B2740]">{data.name}</div>
                                <div className="font-mono text-sm font-bold text-[#7C3AED]">
                                  {formatCurrency(data.value, state.currency.symbol)}
                                </div>
                                <div className="text-[10px] text-[#2B2740]/60">
                                  {data.pct}% of total ({data.count} trip{data.count === 1 ? "" : "s"})
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Store Legend & Percentages */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {storeChartData.map((store, index) => (
                    <div
                      key={store.name}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.03] text-xs hover:bg-black/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: STORE_COLORS[index % STORE_COLORS.length] }}
                        />
                        <span className="font-bold text-[#2B2740] truncate">{store.name}</span>
                        <span className="text-[10px] text-[#2B2740]/50 font-normal">
                          ({store.count} {store.count === 1 ? "trip" : "trips"})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono flex-shrink-0">
                        <span className="font-bold text-[#2B2740]">
                          {formatCurrency(store.value, state.currency.symbol)}
                        </span>
                        <span className="text-[11px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-1.5 py-0.5 rounded-md">
                          {store.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-[#2B2740]/50">No store purchase data found.</div>
            )}
          </div>
        )}

        {/* Diagram 3: Trip Outflow Area Chart */}
        {diagramMode === "trips" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#2B2740]/60">Recent Purchase Trip Velocity</span>
              <span className="text-[11px] text-[#2B2740]/50">Chronological purchase flow</span>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tripChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="tripIndex" stroke="#2B2740" strokeOpacity={0.4} fontSize={10} tickLine={false} />
                  <YAxis
                    stroke="#2B2740"
                    strokeOpacity={0.3}
                    fontSize={10}
                    tickFormatter={(v) => `${state.currency.symbol}${v}`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-black/10 text-xs space-y-0.5">
                            <div className="font-extrabold text-[#2B2740]">{data.store}</div>
                            <div className="font-mono text-sm font-bold text-[#7C3AED]">
                              {formatCurrency(data.amount, state.currency.symbol)}
                            </div>
                            <div className="text-[10px] text-[#2B2740]/50">{data.date}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#B0459E"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#tripGradient)"
                  />
                  <defs>
                    <linearGradient id="tripGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B0459E" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Month Navigator for Purchases */}
      {periodsDesc.length > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl p-3 shadow-xs border border-black/[0.04]">
          <div className="text-xs font-bold text-[#2B2740]/70">Filter purchases by month:</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (activeIndex < periodsDesc.length - 1) {
                  setActivePeriodKey(periodsDesc[activeIndex + 1].key);
                }
              }}
              disabled={activeIndex >= periodsDesc.length - 1}
              className="w-7 h-7 rounded-full bg-black/[0.03] flex items-center justify-center font-bold text-[#7C3AED] disabled:opacity-20 hover:bg-[#7C3AED]/10"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="font-extrabold text-xs text-[#2B2740] min-w-[75px] text-center">
              {currentNavPeriod ? `${currentNavPeriod.month} ${currentNavPeriod.year}` : "All"}
            </span>
            <button
              onClick={() => {
                if (activeIndex > 0) {
                  setActivePeriodKey(periodsDesc[activeIndex - 1].key);
                }
              }}
              disabled={activeIndex <= 0}
              className="w-7 h-7 rounded-full bg-black/[0.03] flex items-center justify-center font-bold text-[#7C3AED] disabled:opacity-20 hover:bg-[#7C3AED]/10"
            >
              <ChevronRight size={15} />
            </button>
            {activePeriodKey !== "all" && (
              <button
                onClick={() => setActivePeriodKey("all")}
                className="text-[10px] text-[#7C3AED] font-bold ml-1 hover:underline"
              >
                View all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Purchases List */}
      <div>
        <div className="flex justify-between items-center text-xs font-bold text-[#2B2740]/60 mb-2.5">
          <span>Shopping Trips ({filteredEntries.length})</span>
          {filteredEntries.length > 6 && (
            <button onClick={() => setShowAllPurchases(!showAllPurchases)} className="text-[#7C3AED] hover:underline">
              {showAllPurchases ? "Show less" : `See all (${filteredEntries.length}) →`}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {displayedPurchases.length > 0 ? (
            displayedPurchases.map((trip) => (
              <div
                key={trip.id}
                className="flex items-center justify-between bg-white rounded-2xl p-3.5 shadow-xs border border-black/[0.04] hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#B0459E]/15 flex items-center justify-center text-base shadow-2xs">
                    🛍️
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#2B2740]">{trip.note}</div>
                    <div className="text-xs text-[#2B2740]/50 font-medium">
                      {trip.month} {trip.year}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-extrabold text-sm text-[#2B2740]">
                    -{formatCurrency(trip.amount, state.currency.symbol)}
                  </span>
                  <button
                    onClick={() => handleDeleteEntry(trip.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#2B2740]/30 hover:text-[#E5484D] hover:bg-[#E5484D]/10 transition-colors"
                    title="Delete entry"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-[#2B2740]/50 py-8 text-center bg-white rounded-2xl border border-black/[0.04]">
              No grocery shopping trips logged for this period.
            </div>
          )}
        </div>
      </div>

      {/* History by Year */}
      {yearsDesc.length > 0 && (
        <div>
          <div className="text-xs font-bold text-[#2B2740]/60 mb-2.5">Yearly Archives</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {yearsDesc.map((year) => {
              const yTotal = byYear[year].reduce((s, e) => s + e.amount, 0);
              return (
                <div
                  key={year}
                  className="flex justify-between items-center bg-white rounded-2xl p-3.5 shadow-xs border border-black/[0.04] text-xs font-bold text-[#2B2740]"
                >
                  <span className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#7C3AED]" />
                    <span>{year} Total</span>
                  </span>
                  <span className="font-mono text-sm font-black text-[#7C3AED]">
                    {formatCurrency(yTotal, state.currency.symbol)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
