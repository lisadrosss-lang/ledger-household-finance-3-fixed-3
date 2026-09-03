import React from "react";
import { ChevronLeft, Database, Sparkles, Bell } from "lucide-react";
import { translate } from "../lib/i18n";
import { CURRENT_YEAR } from "../lib/storage";

interface HeaderProps {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
  lang: string;
  supabaseConnected: boolean;
  onSyncClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  canGoBack,
  onBack,
  supabaseConnected,
  onSyncClick,
}) => {
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3.5 bg-white border-b border-black/[0.08] sticky top-0 z-20 shadow-xs">
      <div className="w-16 flex items-center">
        {canGoBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[15px] font-extrabold text-[#7C3AED] active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        )}
      </div>
      <h1 className="text-base font-extrabold text-[#2B2740] truncate text-center max-w-[180px]">
        {title}
      </h1>
      <div className="w-16 flex justify-end">
        <button
          onClick={onSyncClick}
          title={supabaseConnected ? "Supabase Connected" : "Supabase Sync Settings"}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
            supabaseConnected
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : "bg-purple-50 text-[#7C3AED] border border-purple-200"
          }`}
        >
          <Database size={13} />
          <span className="text-[10px]">{supabaseConnected ? "Live" : "Sync"}</span>
        </button>
      </div>
    </header>
  );
};

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  lang: string;
  supabaseConnected: boolean;
  onOpenReminders?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  lang,
  supabaseConnected,
  onOpenReminders,
}) => {
  const baseView = currentView.split(":")[0];

  return (
    <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-white border-r border-black/[0.08] p-5 h-screen sticky top-0 select-none">
      <div className="flex items-center justify-between px-2 pb-6">
        <div className="flex items-center gap-2.5 font-extrabold text-lg text-[#2B2740]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A64BC9]" />
          <span>Ledger</span>
        </div>
        <button
          onClick={() => onNavigate("sync")}
          title={supabaseConnected ? "Supabase Connected" : "Configure Supabase"}
          className={`w-2.5 h-2.5 rounded-full ring-2 transition-all ${
            supabaseConnected ? "bg-emerald-500 ring-emerald-200" : "bg-amber-400 ring-amber-200"
          }`}
        />
      </div>

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
        <button
          onClick={() => onNavigate("home")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            baseView === "home"
              ? "bg-[#B0459E]/12 text-[#7C3AED]"
              : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.03]"
          }`}
        >
          <span className="text-base">🏠</span>
          <span>{translate("home", lang)}</span>
        </button>

        <button
          onClick={() => onNavigate("bills")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            baseView === "bills" || baseView === "detail"
              ? "bg-[#B0459E]/12 text-[#7C3AED]"
              : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.03]"
          }`}
        >
          <span className="text-base">🧾</span>
          <span>{translate("allBills", lang)}</span>
        </button>

        <button
          onClick={() => onNavigate("groceries")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            baseView === "groceries"
              ? "bg-[#B0459E]/12 text-[#7C3AED]"
              : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.03]"
          }`}
        >
          <span className="text-base">🛒</span>
          <span>Groceries</span>
        </button>

        <button
          onClick={() => onNavigate("categories")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            baseView === "categories" || baseView === "company"
              ? "bg-[#B0459E]/12 text-[#7C3AED]"
              : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.03]"
          }`}
        >
          <span className="text-base">🏷️</span>
          <span>{translate("overview", lang)}</span>
        </button>

        <button
          onClick={() => onNavigate("hub")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            baseView === "hub" || baseView === "account" || baseView === "settings" || baseView === "feedback" || baseView === "login-notes"
              ? "bg-[#B0459E]/12 text-[#7C3AED]"
              : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.03]"
          }`}
        >
          <span className="text-base">🗂️</span>
          <span>{translate("morePages", lang)}</span>
        </button>

        <button
          onClick={() => onNavigate("sync")}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            baseView === "sync"
              ? "bg-[#B0459E]/12 text-[#7C3AED]"
              : "text-[#2B2740]/60 hover:text-[#2B2740] hover:bg-black/[0.03]"
          }`}
        >
          <span className="text-base">🔄</span>
          <span>{translate("sync", lang)}</span>
          {supabaseConnected && (
            <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold">
              Live
            </span>
          )}
        </button>

        {onOpenReminders && (
          <button
            onClick={onOpenReminders}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#7C3AED] bg-[#7C3AED]/10 hover:bg-[#7C3AED]/15 transition-all mt-2"
          >
            <Bell size={16} />
            <span>Bill Reminders</span>
          </button>
        )}

        <button
          onClick={() => onNavigate("addbill")}
          className="mt-3 bg-gradient-to-br from-[#6D3AED] via-[#B0459E] to-[#F2994A] text-white rounded-xl py-3 px-4 font-bold text-sm text-center shadow-md hover:shadow-lg active:scale-95 transition-all"
        >
          {translate("addBill", lang)}
        </button>
      </nav>

      <div className="pt-4 border-t border-black/[0.06] text-xs text-[#2B2740]/50 flex items-center justify-between">
        <span>{CURRENT_YEAR} Ledger</span>
        <button onClick={() => onNavigate("settings")} className="hover:text-[#7C3AED]">
          ⚙️
        </button>
      </div>
    </aside>
  );
};

interface TabbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  lang: string;
}

export const Tabbar: React.FC<TabbarProps> = ({ currentView, onNavigate, lang }) => {
  const baseView = currentView.split(":")[0];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-black/[0.08] px-3 py-2 z-30 shadow-lg">
      <div className="flex justify-around items-center">
        <button
          onClick={() => onNavigate("home")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold min-w-[50px] py-1 transition-colors ${
            baseView === "home" ? "text-[#7C3AED]" : "text-[#2B2740]/50"
          }`}
        >
          <span className="text-lg">🏠</span>
          <span>{translate("home", lang)}</span>
        </button>

        <button
          onClick={() => onNavigate("bills")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold min-w-[50px] py-1 transition-colors ${
            baseView === "bills" || baseView === "detail" ? "text-[#7C3AED]" : "text-[#2B2740]/50"
          }`}
        >
          <span className="text-lg">🧾</span>
          <span>{translate("allBills", lang)}</span>
        </button>

        <button
          onClick={() => onNavigate("groceries")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold min-w-[50px] py-1 transition-colors ${
            baseView === "groceries" ? "text-[#7C3AED]" : "text-[#2B2740]/50"
          }`}
        >
          <span className="text-lg">🛒</span>
          <span>Groceries</span>
        </button>

        <button
          onClick={() => onNavigate("categories")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold min-w-[50px] py-1 transition-colors ${
            baseView === "categories" || baseView === "company" ? "text-[#7C3AED]" : "text-[#2B2740]/50"
          }`}
        >
          <span className="text-lg">🏷️</span>
          <span>{translate("overview", lang)}</span>
        </button>

        <button
          onClick={() => onNavigate("hub")}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold min-w-[50px] py-1 transition-colors ${
            baseView === "hub" || baseView === "account" || baseView === "settings" || baseView === "feedback" || baseView === "login-notes"
              ? "text-[#7C3AED]"
              : "text-[#2B2740]/50"
          }`}
        >
          <span className="text-lg">🗂️</span>
          <span>{translate("more", lang)}</span>
        </button>
      </div>
    </div>
  );
};
