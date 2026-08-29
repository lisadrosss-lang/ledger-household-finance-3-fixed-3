import React, { useState, useRef } from "react";
import { Account, SavingsGoal } from "../../types";
import { formatCurrency } from "../../lib/storage";
import { optimizeLogoImage } from "../../lib/fileOptimizer";
import { Plus, Trash2, PiggyBank, Target, Image as ImageIcon, Camera, X } from "lucide-react";

interface GoalsSectionProps {
  account: Account;
  currencySymbol: string;
  onUpdateAccount: (updated: Account) => void;
  onShowToast: (msg: string) => void;
}

export const GoalsSection: React.FC<GoalsSectionProps> = ({
  account,
  currencySymbol,
  onUpdateAccount,
  onShowToast,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [goalLabel, setGoalLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalPhoto, setGoalPhoto] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);

  // File inputs
  const addModalFileInputRef = useRef<HTMLInputElement>(null);
  const editGoalFileInputRef = useRef<HTMLInputElement>(null);
  const [activeGoalForPhotoEdit, setActiveGoalForPhotoEdit] = useState<number | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isModal = true) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeLogoImage(file, 800, 0.85);
      if (isModal) {
        setGoalPhoto(optimized.data);
        onShowToast("Goal picture selected");
      } else if (activeGoalForPhotoEdit !== null) {
        onUpdateAccount({
          ...account,
          goals: (account.goals || []).map((g) =>
            g.id === activeGoalForPhotoEdit ? { ...g, photo: optimized.data } : g
          ),
        });
        onShowToast("Goal picture updated");
        setActiveGoalForPhotoEdit(null);
      }
    } catch {
      onShowToast("Could not process image");
    }
  };

  const handleAddGoal = () => {
    const target = parseFloat(goalTarget);
    if (isNaN(target) || target <= 0) {
      onShowToast("Please enter a valid target amount");
      return;
    }
    const newGoal: SavingsGoal = {
      id: Date.now(),
      target,
      label: goalLabel.trim() || undefined,
      photo: goalPhoto,
      saved: 0,
    };
    onUpdateAccount({
      ...account,
      goals: [...(account.goals || []), newGoal],
    });
    setGoalLabel("");
    setGoalTarget("");
    setGoalPhoto(null);
    setShowAddModal(false);
    onShowToast("Savings goal created with picture");
  };

  const confirmDeleteGoal = (goal: SavingsGoal) => {
    onUpdateAccount({
      ...account,
      goals: (account.goals || []).filter((g) => g.id !== goal.id),
    });
    setGoalToDelete(null);
    if (previewPhoto && previewPhoto === goal.photo) {
      setPreviewPhoto(null);
    }
    onShowToast(`Goal "${goal.label || "Savings Goal"}" deleted`);
  };

  const handleAddMoney = (goalId: number) => {
    const val = prompt("Enter amount to add to savings goal (€):");
    if (!val) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    onUpdateAccount({
      ...account,
      goals: (account.goals || []).map((g) =>
        g.id === goalId ? { ...g, saved: g.saved + num } : g
      ),
    });
    onShowToast(`${formatCurrency(num, currencySymbol)} added to goal`);
  };

  const goals = account.goals || [];

  return (
    <div className="space-y-4">
      {/* Hidden file input for updating existing goal picture */}
      <input
        ref={editGoalFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePhotoUpload(e, false)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={17} className="text-[#7C3AED]" />
          <div>
            <div className="text-xs font-bold text-[#2B2740]">
              {account.id === "business" ? "Business Savings & Target Goals" : "Personal Goals & Wishlist"}
            </div>
            <div className="text-[11px] text-[#2B2740]/50">
              Attach motivational pictures and track progress towards targets
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D3AED] shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus size={15} />
          <span>Add Goal</span>
        </button>
      </div>

      {/* Goals Grid / List */}
      {goals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
            const isCompleted = g.saved >= g.target;

            return (
              <div
                key={g.id}
                className="bg-white rounded-[22px] overflow-hidden shadow-sm border border-black/[0.05] flex flex-col justify-between group transition-all hover:shadow-md"
              >
                {/* Goal Picture Cover / Banner */}
                {g.photo ? (
                  <div className="relative h-36 w-full bg-black/5 overflow-hidden">
                    <img
                      src={g.photo}
                      alt={g.label || "Goal image"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                      onClick={() => setPreviewPhoto(g.photo!)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                    <button
                      onClick={() => {
                        setActiveGoalForPhotoEdit(g.id);
                        editGoalFileInputRef.current?.click();
                      }}
                      className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/40 text-white backdrop-blur-xs hover:bg-black/60 text-xs flex items-center gap-1 transition-all"
                      title="Change picture"
                    >
                      <Camera size={13} />
                    </button>
                    <div className="absolute bottom-2.5 left-3.5 right-3.5 flex justify-between items-end text-white">
                      <span className="font-extrabold text-sm drop-shadow-md truncate">
                        {g.label || "Savings Goal"}
                      </span>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-[#7C3AED]/80 backdrop-blur-xs">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 pb-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold">
                        🎯
                      </div>
                      <span className="font-extrabold text-sm text-[#2B2740]">
                        {g.label || "Savings Goal"}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setActiveGoalForPhotoEdit(g.id);
                        editGoalFileInputRef.current?.click();
                      }}
                      className="text-[11px] font-bold text-[#7C3AED] hover:underline flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7C3AED]/5"
                    >
                      <ImageIcon size={12} />
                      <span>+ Add Picture</span>
                    </button>
                  </div>
                )}

                {/* Progress & Numbers */}
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <div className="text-xs text-[#2B2740]/60 font-medium">Saved so far</div>
                    <div className="font-mono font-extrabold text-sm text-[#2B2740]">
                      <span className={isCompleted ? "text-[#2E9E71]" : "text-[#7C3AED]"}>
                        {formatCurrency(g.saved, currencySymbol)}
                      </span>
                      <span className="text-[#2B2740]/40 font-normal text-xs ml-1">
                        / {formatCurrency(g.target, currencySymbol)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted
                            ? "bg-[#2E9E71]"
                            : "bg-gradient-to-r from-[#7C3AED] via-[#B0459E] to-[#5FD3A3]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-[#2B2740]/50 font-medium">
                      <span>{isCompleted ? "Goal Completed!" : `${(100 - pct).toFixed(0)}% remaining`}</span>
                      <span>Target: {formatCurrency(g.target, currencySymbol)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-black/[0.04]">
                    <button
                      onClick={() => handleAddMoney(g.id)}
                      className="text-xs font-bold text-[#7C3AED] hover:text-[#6D3AED] hover:underline flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-[#7C3AED]/5 transition-colors"
                    >
                      <Plus size={13} /> Add Money
                    </button>
                    <button
                      onClick={() => setGoalToDelete(g)}
                      className="text-xs font-bold text-[#E5484D] hover:text-[#C53030] hover:bg-[#E5484D]/10 py-1 px-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Delete goal"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[22px] p-8 text-center text-xs text-[#2B2740]/50 border border-black/[0.04] space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mx-auto text-2xl shadow-inner">
            📸
          </div>
          <div>
            <div className="text-sm font-bold text-[#2B2740]">No goals created yet</div>
            <p className="text-[11px] text-[#2B2740]/50 mt-0.5">
              Set savings goals and attach inspirational pictures of what you're working towards!
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-[#7C3AED] text-white font-bold text-xs shadow-sm hover:bg-[#6D3AED]"
          >
            + Create Goal with Picture
          </button>
        </div>
      )}

      {/* CONFIRM DELETE GOAL MODAL */}
      {goalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-black/[0.08] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E5484D] flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-[#2B2740]">Delete Savings Goal?</h3>
              <p className="text-xs text-[#2B2740]/60 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-[#2B2740]">"{goalToDelete.label || "this goal"}"</span>? Target amount of {formatCurrency(goalToDelete.target, currencySymbol)} will be removed.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGoalToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteGoal(goalToDelete)}
                className="flex-1 py-2.5 rounded-xl bg-[#E5484D] text-white font-bold text-xs shadow-md hover:bg-[#C53030] active:scale-95 transition-all"
              >
                Delete Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD GOAL WITH PICTURE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">Create Savings Goal</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740] hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                  Goal Name / Wishlist Title
                </label>
                <input
                  type="text"
                  value={goalLabel}
                  onChange={(e) => setGoalLabel(e.target.value)}
                  placeholder="e.g. New Studio Laptop, Summer Holiday, Tax Reserve"
                  className="w-full p-3 rounded-xl border border-black/10 text-sm font-medium focus:outline-none focus:border-[#7C3AED]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                  Target Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder="e.g. 2500.00"
                  className="w-full p-3 rounded-xl border border-black/10 text-sm font-mono font-bold focus:outline-none focus:border-[#7C3AED]"
                />
              </div>

              {/* Goal Picture Upload */}
              <div>
                <label className="text-xs font-bold text-[#2B2740]/60 block mb-1">
                  Inspirational Picture (optional)
                </label>
                <input
                  ref={addModalFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e, true)}
                />

                {goalPhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-black/10 group">
                    <img src={goalPhoto} alt="Goal preview" className="w-full h-36 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => addModalFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white text-[#2B2740] font-bold text-xs shadow-sm"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoalPhoto(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#E5484D] text-white font-bold text-xs shadow-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addModalFileInputRef.current?.click()}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-black/15 hover:border-[#7C3AED] hover:bg-[#7C3AED]/5 text-[#7C3AED] text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all"
                  >
                    <Camera size={20} />
                    <span>Attach Photo or Picture of your Goal</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddGoal}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
              >
                Save Goal
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

      {/* MODAL: FULL VIEW PHOTO */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl">
            <img src={previewPhoto} alt="Goal preview" className="w-full h-full object-contain" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
