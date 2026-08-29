import React, { useState } from "react";
import { Lock } from "lucide-react";
import { APP_PASSWORD } from "../../lib/storage";

interface PasswordGateViewProps {
  sectionName: string;
  onUnlock: () => void;
}

export const PasswordGateView: React.FC<PasswordGateViewProps> = ({
  sectionName,
  onUnlock,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().toLowerCase() === APP_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="bg-white rounded-[24px] p-8 shadow-sm border border-black/[0.06] text-center max-w-sm mx-auto space-y-4 my-8">
      <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mx-auto text-2xl">
        <Lock size={28} />
      </div>

      <div>
        <h3 className="font-extrabold text-lg text-[#2B2740]">{sectionName} is locked</h3>
        <p className="text-xs text-[#2B2740]/60 mt-1">Enter password to access this account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(false);
          }}
          placeholder="Password"
          autoFocus
          className={`w-full p-3 rounded-xl border text-center text-sm font-mono focus:outline-none ${
            error
              ? "border-[#E5484D] bg-[#E5484D]/5"
              : "border-black/10 focus:border-[#7C3AED]"
          }`}
        />

        {error && (
          <div className="text-xs font-bold text-[#E5484D]">
            Incorrect password — try again.
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-full bg-[#7C3AED] text-white font-bold text-sm shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
        >
          Unlock
        </button>
      </form>
    </div>
  );
};
