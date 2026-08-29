import React from "react";
import { Bill, Category } from "../types";
import { formatCurrency, getPaymentStatus, getRemaining, isBillUrgent } from "../lib/storage";

interface BillCardProps {
  bill: Bill;
  category?: Category;
  currencySymbol: string;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
}

export const BillCard: React.FC<BillCardProps> = ({
  bill,
  category,
  currencySymbol,
  onClick,
  draggable = false,
}) => {
  const status = getPaymentStatus(bill);
  const urgent = isBillUrgent(bill);
  const rem = getRemaining(bill);
  const initial = (category ? category.name : bill.name).trim()[0]?.toUpperCase() || "B";
  const logoToUse = bill.logo || category?.logo || null;

  let pillClass = "bg-[#A64BC9]/12 text-[#7C3AED]";
  let pillText = "Upcoming";

  if (status === "paid") {
    pillClass = "bg-emerald-500/15 text-[#2E9E71]";
    pillText = "Paid";
  } else if (status === "partial") {
    pillClass = "bg-amber-400/20 text-[#B0740E]";
    pillText = "Partial";
  } else if (urgent) {
    pillClass = "bg-[#E5484D] text-white";
    pillText = "Urgent";
  }

  let metaText = "";
  if (status === "paid") {
    metaText = "paid in full";
  } else if (status === "partial") {
    metaText = `${formatCurrency(rem, currencySymbol)} left of ${formatCurrency(bill.amount, currencySymbol)}`;
  } else if (bill.timing === "overdue") {
    metaText = `was due ${bill.due}`;
  } else {
    metaText = `due ${bill.due}`;
  }

  let escTag = null;
  if (bill.escalation === "reminder") escTag = "Reminder sent";
  else if (bill.escalation === "aanmaning") escTag = "Aanmaning sent";
  else if (bill.escalation === "deurwaarder") escTag = "Deurwaarder involved";

  const isEscalated = bill.escalation === "deurwaarder";

  return (
    <div className="flex items-center gap-1.5 w-full group">
      {draggable && (
        <span className="text-[#2B2740]/40 text-base cursor-grab active:cursor-grabbing px-1 select-none">
          ⠿
        </span>
      )}
      <button
        onClick={onClick}
        className={`flex-1 flex items-center gap-3 p-3.5 rounded-[18px] bg-white shadow-sm border text-left transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md ${
          isEscalated
            ? "bg-[#FBEAEA] border-[#7A1F2B]/40"
            : urgent
            ? "bg-[#FFF3F3] border-[#E5484D]/35"
            : "border-black/[0.04]"
        }`}
      >
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center font-bold text-base text-white flex-shrink-0 overflow-hidden shadow-xs"
          style={{ backgroundColor: logoToUse ? "transparent" : category?.color || "#999" }}
        >
          {logoToUse ? (
            <img src={logoToUse} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14.5px] text-[#2B2740] truncate leading-snug">{bill.name}</p>
          <p className="text-xs text-[#2B2740]/60 truncate">{metaText}</p>
          {escTag && (
            <div className="text-[10px] font-extrabold text-[#7A1F2B] uppercase tracking-wider mt-0.5">
              {escTag}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="font-extrabold text-[15.5px] text-[#2B2740] font-mono">
            {formatCurrency(rem, currencySymbol)}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${pillClass}`}>
            {pillText}
          </span>
        </div>
      </button>
    </div>
  );
};
