import React from "react";
import { ChevronRight } from "lucide-react";
import { translate } from "../../lib/i18n";

interface HubViewProps {
  onNavigate: (view: string) => void;
  lang: string;
  onOpenReminders?: () => void;
}

export const HubView: React.FC<HubViewProps> = ({ onNavigate, lang, onOpenReminders }) => {
  const options = [
    {
      id: "feedback",
      label: "Monthly Feedback & AI Advice",
      icon: "✨",
      desc: "Visual performance score, grocery pacing, and monthly recommendations.",
      nav: "feedback",
    },
    {
      id: "reminders",
      label: "Calendar Schedule & Reminders",
      icon: "🔔",
      desc: "School-style Google Calendar subscription link, .ICS feed, and device alerts.",
      nav: "reminders",
    },
    {
      id: "groceries",
      label: "Groceries & Diagrams",
      icon: "🛒",
      desc: "Monthly budget, spending trend diagrams, and store shopping trips.",
      nav: "groceries",
    },
    {
      id: "personal",
      label: "Personal Account",
      icon: "👤",
      desc: "Personal bills, household living budget, savings goals, and cash flow.",
      nav: "account:personal",
    },
    {
      id: "business",
      label: "Business Account",
      icon: "💼",
      desc: "Client invoices, commercial business loans, business expenses, and revenue.",
      nav: "account:business",
    },
    {
      id: "settings",
      label: translate("settings", lang),
      icon: "⚙️",
      desc: "Currency symbol, multilingual preferences, and formatting.",
      nav: "settings",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-[#2B2740]">More Pages & Tools</h2>
        <div className="text-xs font-bold text-[#2B2740]/60 mt-1">Choose a section</div>
      </div>

      <div className="space-y-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => {
              if (opt.id === "reminders" && onOpenReminders) {
                onOpenReminders();
              } else {
                onNavigate(opt.nav);
              }
            }}
            className="w-full flex items-center gap-3.5 bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] text-left hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-xl bg-black/[0.03] flex items-center justify-center text-xl flex-shrink-0">
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-[#2B2740]">{opt.label}</div>
              <div className="text-xs text-[#2B2740]/50 truncate mt-0.5">{opt.desc}</div>
            </div>
            <ChevronRight size={18} className="text-[#2B2740]/30" />
          </button>
        ))}
      </div>
    </div>
  );
};
