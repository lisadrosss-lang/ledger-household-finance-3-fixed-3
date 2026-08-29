import React from "react";
import { AppState } from "../../types";
import { CURRENCIES, LANGUAGES } from "../../lib/i18n";
import { ChevronDown, Coins, Globe } from "lucide-react";

interface SettingsViewProps {
  state: AppState;
  onUpdateCurrency: (currency: { code: string; symbol: string }) => void;
  onUpdateLanguage: (lang: string) => void;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateCurrency,
  onUpdateLanguage,
  onShowToast,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <h2 className="text-xl font-extrabold text-[#2B2740]">Settings</h2>

      {/* Currency Selector */}
      <div className="bg-white rounded-[22px] p-5 shadow-sm border border-black/[0.04] space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
            <Coins size={14} />
          </div>
          <div>
            <div className="text-xs font-bold text-[#2B2740]">Currency</div>
            <p className="text-[11px] text-[#2B2740]/50">
              Applies to every amount displayed across the application.
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            value={state.currency.code}
            onChange={(e) => {
              const opt = CURRENCIES.find((c) => c.code === e.target.value);
              if (opt) {
                onUpdateCurrency({ code: opt.code, symbol: opt.symbol });
                onShowToast(`Currency changed to ${opt.label} (${opt.symbol})`);
              }
            }}
            className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-full border border-black/10 text-sm bg-white font-bold text-[#2B2740] hover:border-[#7C3AED]/40 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] shadow-xs cursor-pointer transition-all"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code} className="text-[#2B2740] font-medium py-1">
                {c.label} ({c.symbol})
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#7C3AED]"
          />
        </div>
      </div>

      {/* Language Selector */}
      <div className="bg-white rounded-[22px] p-5 shadow-sm border border-black/[0.04] space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
            <Globe size={14} />
          </div>
          <div>
            <div className="text-xs font-bold text-[#2B2740]">Language</div>
            <p className="text-[11px] text-[#2B2740]/50">
              Translates navigation labels and main headings.
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            value={state.language}
            onChange={(e) => {
              onUpdateLanguage(e.target.value);
              onShowToast("Language updated");
            }}
            className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-full border border-black/10 text-sm bg-white font-bold text-[#2B2740] hover:border-[#7C3AED]/40 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] shadow-xs cursor-pointer transition-all"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="text-[#2B2740] font-medium py-1">
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#7C3AED]"
          />
        </div>
      </div>
    </div>
  );
};
