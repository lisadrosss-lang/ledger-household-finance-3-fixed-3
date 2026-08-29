import React, { useState } from "react";
import { AppState, Bill, Category, Account } from "../../types";
import { BillCard } from "../BillCard";
import { formatCurrency, getAccountTotal, getRemaining, getPaymentStatus } from "../../lib/storage";
import { ChevronDown, Star, GripVertical, ArrowUpRight } from "lucide-react";

interface HomeViewProps {
  state: AppState;
  onNavigate: (view: string) => void;
  onUpdateVerse: (text: string, ref: string) => void;
  onReorderPriorityBills?: (newBills: Bill[]) => void;
  onReorderCategories?: (categories: Category[]) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  state,
  onNavigate,
  onUpdateVerse,
  onReorderCategories,
}) => {
  const [editingVerse, setEditingVerse] = useState(false);
  const [verseText, setVerseText] = useState(state.verse.text);
  const [verseRef, setVerseRef] = useState(state.verse.reference);
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [draggedHomeCatId, setDraggedHomeCatId] = useState<string | null>(null);

  // Extract periods from bills
  const periodMap: Record<string, { month: string; year: number; key: string }> = {};
  state.bills.forEach((b) => {
    const key = `${b.month}-${b.year}`;
    if (!periodMap[key]) {
      periodMap[key] = { month: b.month, year: b.year, key };
    }
  });
  const periodList = Object.values(periodMap);

  const activeBills = state.bills.filter((b) => {
    if (periodFilter === "all") return true;
    return `${b.month}-${b.year}` === periodFilter;
  });

  const totalDue = activeBills.reduce((sum, b) => sum + getRemaining(b), 0);
  const settledCount = activeBills.filter((b) => getPaymentStatus(b) === "paid").length;

  const priorityBills = activeBills
    .filter((b) => getPaymentStatus(b) !== "paid")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 3);

  const miniAccounts = state.accounts.filter(
    (a) => a.id !== "personal" && a.id !== "business"
  );

  const featuredCompanies = state.categories
    .filter((c) => c.featured)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 6);

  const companiesShown =
    featuredCompanies.length > 0
      ? featuredCompanies
      : state.categories.slice(0, 6);

  const handleHomeCatDrop = (targetIndex: number) => {
    if (!draggedHomeCatId || !onReorderCategories) return;
    const currentList = [...companiesShown];
    const fromIndex = currentList.findIndex((c) => c.id === draggedHomeCatId);
    if (fromIndex === -1) return;

    const [moved] = currentList.splice(fromIndex, 1);
    currentList.splice(targetIndex, 0, moved);

    const updatedAll = state.categories.map((c) => {
      const idx = currentList.findIndex((item) => item.id === c.id);
      if (idx !== -1) {
        return { ...c, featured: true, sortOrder: idx };
      }
      return c;
    });

    onReorderCategories(updatedAll);
    setDraggedHomeCatId(null);
  };

  const handleSaveVerse = () => {
    if (!verseText.trim()) return;
    onUpdateVerse(verseText.trim(), verseRef.trim());
    setEditingVerse(false);
  };

  const selectedPeriod = periodList.find((p) => p.key === periodFilter);
  const bannerLabel = periodFilter === "all" ? "Due total" : `Due in ${selectedPeriod?.month || ""} ${selectedPeriod?.year || ""}`;

  return (
    <div className="space-y-5">
      {/* Month / Period Selector Bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#2B2740]/60">Overview</span>
        <div className="relative inline-flex items-center">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="appearance-none text-xs font-bold pl-3.5 pr-8 py-1.5 rounded-full border border-black/10 bg-white text-[#2B2740] shadow-xs hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 transition-all cursor-pointer"
          >
            <option value="all">All time</option>
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
      </div>

      {/* Due Hero Banner */}
      <button
        onClick={() => onNavigate("bills")}
        className="w-full text-left bg-gradient-to-br from-[#6D3AED] via-[#B0459E] to-[#F2994A] text-white rounded-[22px] p-6 shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
      >
        <div className="text-xs font-semibold opacity-90 mb-1 tracking-wide">{bannerLabel}</div>
        <div className="text-[34px] font-extrabold tracking-tight font-mono">
          {formatCurrency(totalDue, state.currency.symbol)}
        </div>
        <div className="flex justify-between items-center mt-4 text-[12.5px] opacity-95">
          <span>{activeBills.length} bills</span>
          <span>{settledCount} settled</span>
        </div>
        <div className="mt-3 text-[11.5px] opacity-80 flex items-center gap-1">
          <span>Tap to see every bill →</span>
        </div>
      </button>

      {/* Editable Scripture Verse */}
      {editingVerse ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] space-y-3">
          <div className="text-xs font-bold text-[#2B2740]/60">Verse text</div>
          <textarea
            value={verseText}
            onChange={(e) => setVerseText(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED] min-h-[64px]"
            placeholder="Verse text..."
          />
          <div className="text-xs font-bold text-[#2B2740]/60">Reference</div>
          <input
            type="text"
            value={verseRef}
            onChange={(e) => setVerseRef(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
            placeholder="e.g. Philippians 4:19"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveVerse}
              className="px-5 py-2 rounded-full bg-[#7C3AED] text-white font-bold text-xs shadow-sm hover:bg-[#6D3AED]"
            >
              Save
            </button>
            <button
              onClick={() => {
                setVerseText(state.verse.text);
                setVerseRef(state.verse.reference);
                setEditingVerse(false);
              }}
              className="px-5 py-2 rounded-full bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditingVerse(true)}
          className="w-full text-center font-serif italic text-base text-[#7C3AED] p-3.5 rounded-2xl hover:bg-[#7C3AED]/5 transition-colors cursor-pointer block"
        >
          <span>“{state.verse.text}”</span>
          <span className="block font-sans not-italic text-[11.5px] font-bold tracking-wider uppercase text-[#2B2740]/50 mt-1.5">
            {state.verse.reference}
          </span>
        </button>
      )}

      {/* Account Mini Tiles */}
      <div className="grid grid-cols-2 gap-3">
        {miniAccounts.map((acc) => {
          const total = getAccountTotal(acc);
          let valClass = "text-[#2B2740]";
          if (total < 0) valClass = "text-[#E5484D]";
          else if (acc.id === "snappcar" || acc.id === "emergency") valClass = "text-[#2E9E71]";

          return (
            <button
              key={acc.id}
              onClick={() => onNavigate(`account:${acc.id}`)}
              className="bg-white rounded-2xl p-3.5 shadow-sm border border-black/[0.04] text-left hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="text-[11px] text-[#2B2740]/60 mb-1 flex items-center gap-1.5">
                <span>{acc.label}</span>
                {acc.tag && (
                  <span className="text-[9px] font-extrabold bg-[#B0459E]/12 text-[#7C3AED] px-1.5 py-0.5 rounded">
                    {acc.tag}
                  </span>
                )}
              </div>
              <div className={`text-lg font-bold font-mono ${valClass}`}>
                {formatCurrency(total, state.currency.symbol)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Priority Bills Section */}
      <div>
        <div className="flex justify-between items-center mb-3 text-xs font-bold text-[#2B2740]/60">
          <span>Priority bills</span>
          <button
            onClick={() => onNavigate("bills")}
            className="text-xs font-bold text-[#7C3AED] hover:underline"
          >
            See all →
          </button>
        </div>

        <div className="space-y-2.5">
          {priorityBills.length > 0 ? (
            priorityBills.map((b) => {
              const cat = state.categories.find((c) => c.id === b.category);
              return (
                <BillCard
                  key={b.id}
                  bill={b}
                  category={cat}
                  currencySymbol={state.currency.symbol}
                  onClick={() => onNavigate(`detail:${b.id}`)}
                />
              );
            })
          ) : (
            <div className="text-xs text-[#2B2740]/50 py-3 text-center bg-white rounded-2xl border border-black/[0.04]">
              Nothing pending right now. All bills are settled! 🎉
            </div>
          )}
        </div>
      </div>

      {/* Companies Grid */}
      <div>
        <div className="flex justify-between items-center mb-3 text-xs font-bold text-[#2B2740]/60">
          <div className="flex items-center gap-1.5">
            <span>{featuredCompanies.length > 0 ? "Pinned Companies" : "Companies"}</span>
          </div>
          <button
            onClick={() => onNavigate("categories")}
            className="text-xs font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
          >
            <span>Overview</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {companiesShown.map((cat, idx) => {
            const catBills = state.bills.filter((b) => b.category === cat.id);
            const dueForCat = catBills.reduce((s, b) => s + getRemaining(b), 0);
            const initial = cat.name.trim()[0]?.toUpperCase() || "C";

            return (
              <div
                key={cat.id}
                draggable={!!onReorderCategories}
                onDragStart={() => setDraggedHomeCatId(cat.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleHomeCatDrop(idx)}
                onClick={() => onNavigate(`company:${cat.id}`)}
                style={{ borderLeftColor: cat.color }}
                className="group bg-white rounded-2xl p-3.5 shadow-sm border border-l-4 border-black/[0.04] text-left hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white flex-shrink-0 shadow-xs overflow-hidden"
                    style={{ backgroundColor: cat.logo ? "transparent" : cat.color }}
                  >
                    {cat.logo ? (
                      <img src={cat.logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-xs text-[#2B2740] truncate leading-snug">
                      {cat.name}
                    </div>
                    <div className="text-[10px] text-[#2B2740]/50">
                      {catBills.length} {catBills.length === 1 ? "bill" : "bills"}
                    </div>
                  </div>
                </div>

                <div className="font-mono font-extrabold text-sm text-[#2B2740] pt-1.5 border-t border-black/[0.03]">
                  {formatCurrency(dueForCat, state.currency.symbol)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
