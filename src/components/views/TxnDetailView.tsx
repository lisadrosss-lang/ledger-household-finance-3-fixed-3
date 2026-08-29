import React, { useState } from "react";
import { AppState, Transaction, Account } from "../../types";
import { formatCurrency } from "../../lib/storage";
import { Trash2, Edit3 } from "lucide-react";

interface TxnDetailViewProps {
  param: string; // "accountId:txnId"
  state: AppState;
  onNavigate: (view: string) => void;
  onUpdateAccount: (updated: Account) => void;
  onShowToast: (msg: string) => void;
  onGoBack: () => void;
}

export const TxnDetailView: React.FC<TxnDetailViewProps> = ({
  param,
  state,
  onNavigate,
  onUpdateAccount,
  onShowToast,
  onGoBack,
}) => {
  const [accId, txnIdStr] = (param || "").split(":");
  const txnId = Number(txnIdStr);
  const account = state.accounts.find((a) => a.id === accId);
  const txn = account?.transactions.find((t) => t.id === txnId);

  const [isEditing, setIsEditing] = useState(false);
  const [editNote, setEditNote] = useState(txn?.note || "");
  const [editMonth, setEditMonth] = useState(txn?.month || "");
  const [editYear, setEditYear] = useState(txn?.year || 2026);
  const [editAmount, setEditAmount] = useState(txn?.amount?.toString() || "0");

  if (!account || !txn) {
    return (
      <div className="text-center py-12 text-[#2B2740]/60">
        <p>Transaction not found.</p>
        <button onClick={onGoBack} className="mt-4 text-[#7C3AED] font-bold text-sm">
          ← Back
        </button>
      </div>
    );
  }

  const handleSave = () => {
    const amt = parseFloat(editAmount);
    if (!editNote.trim() || isNaN(amt)) {
      onShowToast("Please enter a note and valid amount");
      return;
    }
    const updatedTxns = account.transactions.map((t) =>
      t.id === txn.id
        ? {
            ...t,
            note: editNote.trim(),
            month: editMonth.trim(),
            year: editYear,
            amount: amt,
          }
        : t
    );
    onUpdateAccount({ ...account, transactions: updatedTxns });
    setIsEditing(false);
    onShowToast("Transaction updated");
  };

  const handleDelete = () => {
    const updatedTxns = account.transactions.filter((t) => t.id !== txn.id);
    onUpdateAccount({ ...account, transactions: updatedTxns });
    onShowToast("Transaction removed");
    onNavigate(`account:${account.id}`);
  };

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-[#6D3AED] to-[#B0459E] text-white rounded-[22px] p-6 text-center shadow-lg">
        <div className="text-xs font-semibold opacity-85 mb-1">{txn.note}</div>
        <div className="text-3xl font-extrabold font-mono">
          {formatCurrency(txn.amount, state.currency.symbol)}
        </div>
      </div>

      {/* Edit Card */}
      {isEditing ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#7C3AED]/40 space-y-3">
          <div>
            <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Note</div>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Month</div>
              <input
                type="text"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Year</div>
              <input
                type="number"
                value={editYear}
                onChange={(e) => setEditYear(parseInt(e.target.value, 10) || 2026)}
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Amount (€)</div>
            <input
              type="number"
              step="0.01"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-2.5 rounded-full bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] divide-y divide-black/[0.04] text-xs">
          <div className="flex justify-between py-2.5">
            <span className="text-[#2B2740]/60">Account</span>
            <span className="font-bold text-[#2B2740]">{account.label}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-[#2B2740]/60">Month</span>
            <span className="font-bold text-[#2B2740]">{txn.month}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-[#2B2740]/60">Year</span>
            <span className="font-bold text-[#2B2740]">{txn.year}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-[#2B2740]/60">Type</span>
            <span className={`font-bold ${txn.amount < 0 ? "text-[#E5484D]" : "text-[#2E9E71]"}`}>
              {txn.amount < 0 ? "Money out" : "Money in"}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="w-full py-3.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-sm shadow-md hover:bg-[#6D3AED] flex items-center justify-center gap-2"
        >
          <Edit3 size={15} />
          <span>Edit transaction</span>
        </button>

        <button
          onClick={handleDelete}
          className="w-full py-2.5 text-center text-[#E5484D] font-bold text-xs hover:underline flex items-center justify-center gap-1"
        >
          <Trash2 size={13} />
          <span>Remove this transaction</span>
        </button>
      </div>
    </div>
  );
};
