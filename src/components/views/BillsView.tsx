import React, { useState } from "react";
import { AppState, Bill } from "../../types";
import { BillCard } from "../BillCard";
import {
  formatCurrency,
  getPaymentStatus,
  getRemaining,
  isBillUrgent,
  monthOrder,
  periodKey,
  CURRENT_YEAR,
} from "../../lib/storage";
import { ChevronDown, Bell, Sparkles } from "lucide-react";

interface BillsViewProps {
  state: AppState;
  onNavigate: (view: string) => void;
  categoryFilter?: string | null;
  onClearCategoryFilter: () => void;
  onOpenReminders?: () => void;
  onReorderBills?: (bills: Bill[]) => void;
}

export const BillsView: React.FC<BillsViewProps> = ({
  state,
  onNavigate,
  categoryFilter,
  onClearCategoryFilter,
  onOpenReminders,
  onReorderBills,
}) => {
  const [activeFilter, setActiveFilter] = useState<"all" | "urgent" | "upcoming" | "partial" | "paid">("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [addingMonth, setAddingMonth] = useState(false);
  const [extraMonths, setExtraMonths] = useState<{ month: string; year: number; key: string }[]>([]);
  const [newMonth, setNewMonth] = useState("Aug");
  const [newYear, setNewYear] = useState(CURRENT_YEAR);
  const [draggedBillId, setDraggedBillId] = useState<number | null>(null);
  const [dropBillId, setDropBillId] = useState<number | null>(null);

  // Generate periods from bills + extra
  const periodMap: Record<string, { month: string; year: number; key: string }> = {};
  state.bills.forEach((b) => {
    const key = `${b.month}-${b.year}`;
    if (!periodMap[key]) {
      periodMap[key] = { month: b.month, year: b.year, key };
    }
  });
  extraMonths.forEach((m) => {
    if (!periodMap[m.key]) {
      periodMap[m.key] = m;
    }
  });

  const periodList = Object.values(periodMap).sort(
    (a, b) => periodKey(b.year, b.month) - periodKey(a.year, a.month)
  );

  const periodBills = state.bills.filter((b) => {
    if (periodFilter === "all") return true;
    return `${b.month}-${b.year}` === periodFilter;
  });

  const urgentBills = periodBills.filter(isBillUrgent);
  const upcomingBills = periodBills.filter((b) => b.timing === "upcoming" && getPaymentStatus(b) !== "paid");
  const partialBills = periodBills.filter((b) => getPaymentStatus(b) === "partial");
  const paidBills = periodBills.filter((b) => getPaymentStatus(b) === "paid");

  const summaryDefs = [
    { key: "urgent" as const, label: "Urgent", color: "#E5484D", items: urgentBills, amt: urgentBills.reduce((s, b) => s + getRemaining(b), 0) },
    { key: "upcoming" as const, label: "Upcoming", color: "#7C3AED", items: upcomingBills, amt: upcomingBills.reduce((s, b) => s + getRemaining(b), 0) },
    { key: "partial" as const, label: "Partial", color: "#F5B94E", items: partialBills, amt: partialBills.reduce((s, b) => s + getRemaining(b), 0) },
    { key: "paid" as const, label: "Paid", color: "#5FD3A3", items: paidBills, amt: paidBills.reduce((s, b) => s + b.amount, 0) },
  ];

  const filteredBills = periodBills.filter((b) => {
    if (categoryFilter && b.category !== categoryFilter) return false;
    if (activeFilter === "all") return true;
    if (activeFilter === "urgent") return isBillUrgent(b);
    if (activeFilter === "paid") return getPaymentStatus(b) === "paid";
    if (activeFilter === "partial") return getPaymentStatus(b) === "partial";
    if (activeFilter === "upcoming") return b.timing === "upcoming" && getPaymentStatus(b) !== "paid";
    return true;
  }).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const activeCategory = categoryFilter ? state.categories.find((c) => c.id === categoryFilter) : null;

  const handleAddMonth = () => {
    const key = `${newMonth}-${newYear}`;
    if (!extraMonths.some((m) => m.key === key)) {
      setExtraMonths([...extraMonths, { month: newMonth, year: newYear, key }]);
    }
    setPeriodFilter(key);
    setAddingMonth(false);
  };

  const handleBillDrop = (targetId: number) => {
    if (draggedBillId === null || draggedBillId === targetId || !onReorderBills) return;
    const reordered = [...state.bills];
    const fromIndex = reordered.findIndex((b) => b.id === draggedBillId);
    const targetIndex = reordered.findIndex((b) => b.id === targetId);
    if (fromIndex === -1 || targetIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onReorderBills(reordered.map((bill, index) => ({ ...bill, sortOrder: index })));
    setDraggedBillId(null);
    setDropBillId(null);
  };

  return (
    <div className="space-y-5">
      {/* Month Selector Bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#2B2740]/60">Browse by month</span>
        <div className="flex items-center gap-2">
          <div className="relative inline-flex items-center">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className={`appearance-none text-xs font-bold pl-3.5 pr-8 py-1.5 rounded-full border shadow-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 transition-all cursor-pointer ${
                periodFilter !== "all"
                  ? "bg-[#7C3AED] text-white border-transparent"
                  : "bg-white text-[#2B2740] border-black/10 hover:border-black/20"
              }`}
            >
              <option value="all" className="bg-white text-[#2B2740]">All time</option>
              {periodList.map((p) => (
                <option key={p.key} value={p.key} className="bg-white text-[#2B2740]">
                  {p.month} {p.year}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                periodFilter !== "all" ? "text-white" : "text-[#2B2740]/60"
              }`}
            />
          </div>
          <button
            onClick={() => setAddingMonth(!addingMonth)}
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-black/10 text-[#7C3AED] hover:bg-[#7C3AED]/5 shadow-xs transition-all active:scale-95"
          >
            + Month
          </button>
        </div>
      </div>

      {/* Add Month Inline Form */}
      {addingMonth && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] space-y-3">
          <div className="text-xs font-bold text-[#2B2740]/60">Add a month to browse</div>
          <div className="flex gap-2">
            <select
              value={newMonth}
              onChange={(e) => setNewMonth(e.target.value)}
              className="flex-1 p-2.5 rounded-xl border border-black/10 text-sm bg-white"
            >
              {monthOrder.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(parseInt(e.target.value, 10) || CURRENT_YEAR)}
              className="w-24 p-2.5 rounded-xl border border-black/10 text-sm font-mono text-center"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddMonth}
              className="px-5 py-2 rounded-full bg-[#7C3AED] text-white font-bold text-xs shadow-sm hover:bg-[#6D3AED]"
            >
              Add
            </button>
            <button
              onClick={() => setAddingMonth(false)}
              className="px-5 py-2 rounded-full bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div>
        <div className="text-xs font-bold text-[#2B2740]/60 mb-2.5">Summary</div>
        <div className="grid grid-cols-2 gap-3">
          {summaryDefs.map((s) => {
            const isActive = activeFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveFilter(isActive ? "all" : s.key)}
                style={{ borderLeftColor: s.color }}
                className={`bg-white rounded-2xl p-3.5 shadow-sm border border-l-4 border-black/[0.04] text-left transition-all ${
                  isActive ? "ring-2 ring-[#7C3AED] shadow-md" : "hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                <div className="font-bold text-xs text-[#2B2740]/70 truncate mb-1">
                  {s.label} · {s.items.length}
                </div>
                <div className="font-mono font-bold text-base text-[#2B2740]">
                  {formatCurrency(s.amt, state.currency.symbol)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter Badge */}
      {activeCategory && (
        <div className="flex items-center justify-between bg-[#7C3AED]/10 px-3.5 py-2 rounded-xl text-xs text-[#7C3AED] font-semibold">
          <span>Filtered by: <strong>{activeCategory.name}</strong></span>
          <button onClick={onClearCategoryFilter} className="font-bold underline hover:text-[#6D3AED]">
            Clear
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["all", "All"],
            ["urgent", "Urgent"],
            ["upcoming", "Upcoming"],
            ["partial", "Partial"],
            ["paid", "Paid"],
          ] as const
        ).map(([fKey, fLabel]) => {
          const active = activeFilter === fKey;
          return (
            <button
              key={fKey}
              onClick={() => setActiveFilter(fKey)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ${
                active
                  ? "bg-[#7C3AED] text-white shadow-sm"
                  : "bg-white text-[#2B2740]/60 hover:bg-black/5"
              }`}
            >
              {fLabel}
            </button>
          );
        })}
      </div>

      {/* Bills Stack */}
      <div>
        <div className="flex justify-between items-center mb-3 text-xs font-bold text-[#2B2740]/60">
          <span>All bills</span>
          <span className="font-mono text-[11.5px]">{filteredBills.length}</span>
        </div>

        <div className="space-y-2.5">
          {filteredBills.length > 0 ? (
            filteredBills.map((b) => {
              const cat = state.categories.find((c) => c.id === b.category);
              return (
                <React.Fragment key={b.id}>
                  {dropBillId === b.id && draggedBillId !== b.id && (
                    <div className="h-1 rounded-full bg-[#7C3AED] shadow-sm" aria-label="Drop bill here" />
                  )}
                  <BillCard
                    bill={b}
                    category={cat}
                    currencySymbol={state.currency.symbol}
                    draggable={!!onReorderBills}
                    onDragStart={() => setDraggedBillId(b.id)}
                    onDragOver={() => setDropBillId(b.id)}
                    onDrop={() => handleBillDrop(b.id)}
                    onDragEnd={() => {
                      setDraggedBillId(null);
                      setDropBillId(null);
                    }}
                    onClick={() => onNavigate(`detail:${b.id}`)}
                  />
                </React.Fragment>
              );
            })
          ) : (
            <div className="text-xs text-[#2B2740]/50 py-6 text-center bg-white rounded-2xl border border-black/[0.04]">
              No bills found for this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
