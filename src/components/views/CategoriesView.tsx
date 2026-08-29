import React, { useState, useRef, useMemo } from "react";
import { AppState, Category } from "../../types";
import { formatCurrency, getRemaining, swatchOptions } from "../../lib/storage";
import { optimizeLogoImage } from "../../lib/fileOptimizer";
import {
  Upload,
  Trash2,
  Edit3,
  Plus,
  Star,
  Search,
  Check,
  X,
  ArrowUpRight,
} from "lucide-react";

interface CategoriesViewProps {
  state: AppState;
  onNavigate: (view: string) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories?: (categories: Category[]) => void;
  onShowToast: (msg: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  state,
  onNavigate,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Add state
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatColor, setNewCatColor] = useState(swatchOptions[0]);
  const [newCatFeatured, setNewCatFeatured] = useState(false);
  const [newCatLogo, setNewCatLogo] = useState<string | null>(null);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState(swatchOptions[0]);
  const [editFeatured, setEditFeatured] = useState(false);
  const [editLogo, setEditLogo] = useState<string | null>(null);

  // File refs
  const addLogoInputRef = useRef<HTMLInputElement>(null);
  const editLogoInputRef = useRef<HTMLInputElement>(null);

  const getCatDue = (catId: string) => {
    return state.bills
      .filter((b) => b.category === catId)
      .reduce((s, b) => s + getRemaining(b), 0);
  };

  const getCatBillCount = (catId: string) => {
    return state.bills.filter((b) => b.category === catId).length;
  };

  const totalDueAll = useMemo(() => {
    return state.bills.reduce((s, b) => s + getRemaining(b), 0);
  }, [state.bills]);

  // Toggle Pin (Featured on Home)
  const handleTogglePin = (cat: Category, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = { ...cat, featured: !cat.featured };
    onUpdateCategory(updated);
    onShowToast(
      updated.featured
        ? `Pinned "${cat.name}" to Home`
        : `Unpinned "${cat.name}" from Home`
    );
  };

  const handleFileProcess = async (
    file: File,
    onSuccess: (data: string) => void
  ) => {
    try {
      const optimized = await optimizeLogoImage(file, 400, 0.85);
      onSuccess(optimized.data);
    } catch {
      onShowToast("Could not process logo");
    }
  };

  const handleAddSubmit = () => {
    if (!newCatName.trim()) {
      onShowToast("Please enter a company name");
      return;
    }
    const id =
      newCatName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
    const newCat: Category = {
      id,
      name: newCatName.trim(),
      description: newCatDesc.trim(),
      color: newCatColor,
      featured: newCatFeatured,
      logo: newCatLogo,
      sortOrder: state.categories.length,
    };
    onAddCategory(newCat);
    setNewCatName("");
    setNewCatDesc("");
    setNewCatColor(swatchOptions[0]);
    setNewCatFeatured(false);
    setNewCatLogo(null);
    setShowAddModal(false);
    onShowToast(`Company "${newCat.name}" added`);
  };

  const openEditModal = (cat: Category, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditDesc(cat.description || "");
    setEditColor(cat.color || swatchOptions[0]);
    setEditFeatured(!!cat.featured);
    setEditLogo(cat.logo || null);
  };

  const handleSaveEdit = () => {
    if (!editingCategory) return;
    if (!editName.trim()) {
      onShowToast("Company name cannot be empty");
      return;
    }
    onUpdateCategory({
      ...editingCategory,
      name: editName.trim(),
      description: editDesc.trim(),
      color: editColor,
      featured: editFeatured,
      logo: editLogo,
    });
    setEditingCategory(null);
    onShowToast(`Company "${editName.trim()}" updated`);
  };

  const confirmDelete = () => {
    if (!categoryToDelete) return;
    onDeleteCategory(categoryToDelete.id);
    setCategoryToDelete(null);
  };

  const filteredCategories = useMemo(() => {
    const list = state.categories.filter((c) => {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
      );
    });

    // Pinned first, then alphabetical
    return list.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [state.categories, searchQuery]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. Header & Summary Overview */}
      <div className="bg-white rounded-[22px] p-5 shadow-sm border border-black/[0.04] space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-extrabold text-[#2B2740]">
              Companies Overview
            </h2>
            <p className="text-xs text-[#2B2740]/60 mt-0.5">
              Overview of what needs to be paid to each company.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-[#7C3AED] text-white font-bold text-xs shadow-sm hover:bg-[#6D3AED] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Company</span>
          </button>
        </div>

        {/* Totals Banner */}
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] text-xs">
          <span className="font-bold text-[#2B2740]/60">
            Total to be paid across {state.categories.length} companies:
          </span>
          <span className="font-mono font-extrabold text-base text-[#7C3AED]">
            {formatCurrency(totalDueAll, state.currency.symbol)}
          </span>
        </div>
      </div>

      {/* 2. Simple Search */}
      {state.categories.length > 3 && (
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2B2740]/40"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white border border-black/[0.06] text-xs focus:outline-none focus:border-[#7C3AED] shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2B2740]/40 hover:text-[#2B2740]"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* 3. Companies List (Clean Overview of what needs to be paid) */}
      <div className="space-y-3">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((c) => {
            const due = getCatDue(c.id);
            const billCount = getCatBillCount(c.id);
            const initial = c.name.trim()[0]?.toUpperCase() || "C";
            const isPinned = !!c.featured;

            return (
              <div
                key={c.id}
                onClick={() => onNavigate(`company:${c.id}`)}
                className="group bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05] hover:shadow-md transition-all cursor-pointer space-y-3"
                style={{ borderLeftWidth: "5px", borderLeftColor: c.color }}
              >
                {/* Main Row: Company & Due Amount */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Logo / Avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-xs overflow-hidden"
                      style={{
                        backgroundColor: c.logo ? "transparent" : c.color,
                      }}
                    >
                      {c.logo ? (
                        <img
                          src={c.logo}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initial
                      )}
                    </div>

                    {/* Name & Description */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#2B2740] group-hover:text-[#7C3AED] transition-colors truncate">
                          {c.name}
                        </span>
                      </div>
                      {c.description ? (
                        <p className="text-xs text-[#2B2740]/60 truncate mt-0.5">
                          {c.description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#2B2740]/40 mt-0.5">
                          {billCount} {billCount === 1 ? "bill" : "bills"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Unpaid Due Amount */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10.5px] font-bold text-[#2B2740]/50 uppercase tracking-wider">
                      To Pay
                    </div>
                    <div className="font-mono font-extrabold text-base text-[#2B2740]">
                      {formatCurrency(due, state.currency.symbol)}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] text-xs">
                  <div className="flex items-center gap-2">
                    {/* Pin / Unpin Button */}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(c, e)}
                      className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
                        isPinned
                          ? "bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20"
                          : "text-[#2B2740]/50 hover:text-[#7C3AED] hover:bg-black/5"
                      }`}
                      title={isPinned ? "Unpin from Home" : "Pin to Home screen"}
                    >
                      <Star
                        size={13}
                        className={isPinned ? "fill-[#7C3AED]" : ""}
                      />
                      <span>{isPinned ? "Pinned on Home" : "Pin to Home"}</span>
                    </button>

                    {/* View Bills Link */}
                    <span className="text-[#2B2740]/40 text-xs flex items-center gap-0.5 group-hover:text-[#7C3AED] transition-colors">
                      View bills <ArrowUpRight size={12} />
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => openEditModal(c, e)}
                      className="p-1.5 rounded-lg text-[#2B2740]/40 hover:text-[#7C3AED] hover:bg-black/5 transition-colors"
                      title="Edit company"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryToDelete(c);
                      }}
                      className="p-1.5 rounded-lg text-[#2B2740]/40 hover:text-[#E5484D] hover:bg-red-50 transition-colors"
                      title="Delete company"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-[20px] p-8 text-center text-xs text-[#2B2740]/50 border border-black/[0.04]">
            {searchQuery
              ? `No companies match "${searchQuery}".`
              : "No companies added yet. Click + Add Company to create one."}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD COMPANY */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">
                Add Company
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740]"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
                Company Name <span className="text-[#E5484D]">*</span>
              </label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Electric Company, Rent, Insurance"
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
                Description / Notes (Optional)
              </label>
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="e.g. Monthly utilities, account #, IBAN..."
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1.5">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {swatchOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCatColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-all flex items-center justify-center text-white ${
                      newCatColor === c
                        ? "ring-2 ring-offset-2 ring-[#7C3AED] scale-110"
                        : "hover:scale-105 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {newCatColor === c && <Check size={13} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1.5">
                Logo (Optional)
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                  style={{
                    backgroundColor: newCatLogo ? "transparent" : newCatColor,
                  }}
                >
                  {newCatLogo ? (
                    <img
                      src={newCatLogo}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    newCatName.trim()[0]?.toUpperCase() || "C"
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addLogoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-black/5 text-[#2B2740] font-bold text-xs hover:bg-black/10 flex items-center gap-1.5"
                >
                  <Upload size={13} />
                  <span>Upload Logo</span>
                </button>
                {newCatLogo && (
                  <button
                    type="button"
                    onClick={() => setNewCatLogo(null)}
                    className="text-xs font-bold text-[#E5484D] hover:underline"
                  >
                    Remove
                  </button>
                )}
                <input
                  ref={addLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileProcess(f, (d) => setNewCatLogo(d));
                  }}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/[0.02] border border-black/5 cursor-pointer">
              <input
                type="checkbox"
                checked={newCatFeatured}
                onChange={(e) => setNewCatFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED]"
              />
              <span className="text-xs font-bold text-[#2B2740]">
                Pin this company to Home screen
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddSubmit}
                className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] transition-all"
              >
                Add Company
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT COMPANY */}
      {/* ========================================================================= */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#2B2740]">
                Edit Company
              </h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1 rounded-full text-[#2B2740]/40 hover:text-[#2B2740]"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
                Company Name <span className="text-[#E5484D]">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
                Description / Notes
              </label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1.5">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {swatchOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-all flex items-center justify-center text-white ${
                      editColor === c
                        ? "ring-2 ring-offset-2 ring-[#7C3AED] scale-110"
                        : "hover:scale-105 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {editColor === c && <Check size={13} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#2B2740]/70 block mb-1.5">
                Logo
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                  style={{
                    backgroundColor: editLogo ? "transparent" : editColor,
                  }}
                >
                  {editLogo ? (
                    <img
                      src={editLogo}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    editName.trim()[0]?.toUpperCase() || "C"
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => editLogoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-black/5 text-[#2B2740] font-bold text-xs hover:bg-black/10 flex items-center gap-1.5"
                >
                  <Upload size={13} />
                  <span>Upload Logo</span>
                </button>
                {editLogo && (
                  <button
                    type="button"
                    onClick={() => setEditLogo(null)}
                    className="text-xs font-bold text-[#E5484D] hover:underline"
                  >
                    Remove
                  </button>
                )}
                <input
                  ref={editLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileProcess(f, (d) => setEditLogo(d));
                  }}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-black/[0.02] border border-black/5 cursor-pointer">
              <input
                type="checkbox"
                checked={editFeatured}
                onChange={(e) => setEditFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED]"
              />
              <span className="text-xs font-bold text-[#2B2740]">
                Pin this company to Home screen
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] transition-all"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2.5 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE */}
      {/* ========================================================================= */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-black/[0.08] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E5484D] flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base text-[#2B2740]">
                Delete Company?
              </h3>
              <p className="text-xs text-[#2B2740]/60 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-[#2B2740]">
                  "{categoryToDelete.name}"
                </span>
                ?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-black/5 text-[#2B2740]/70 font-bold text-xs hover:bg-black/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-[#E5484D] text-white font-bold text-xs shadow-md hover:bg-[#C53030] active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CompanyDetailViewProps {
  categoryId: string;
  state: AppState;
  onNavigate: (view: string) => void;
  onUpdateCategory: (category: Category) => void;
  onShowToast: (msg: string) => void;
}

export const CompanyDetailView: React.FC<CompanyDetailViewProps> = ({
  categoryId,
  state,
  onNavigate,
  onUpdateCategory,
  onShowToast,
}) => {
  const company = state.categories.find((c) => c.id === categoryId);
  const bills = state.bills.filter((b) => b.category === categoryId);
  const totalDue = bills.reduce((sum, b) => sum + getRemaining(b), 0);
  const initial = company?.name.trim()[0]?.toUpperCase() || "C";

  if (!company) {
    return (
      <div className="space-y-4 p-6 bg-white rounded-2xl text-center border border-black/5">
        <p className="text-sm font-bold text-[#2B2740]">Company not found</p>
        <button
          onClick={() => onNavigate("categories")}
          className="px-4 py-2 bg-[#7C3AED] text-white text-xs font-bold rounded-full"
        >
          Back to Overview
        </button>
      </div>
    );
  }

  const handleTogglePin = () => {
    const updated = { ...company, featured: !company.featured };
    onUpdateCategory(updated);
    onShowToast(
      updated.featured
        ? `Pinned "${company.name}" to Home`
        : `Unpinned "${company.name}" from Home`
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div
        className="bg-white rounded-[22px] p-5 shadow-sm border border-black/[0.05] space-y-4"
        style={{ borderLeftWidth: "6px", borderLeftColor: company.color }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate("categories")}
            className="text-xs font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
          >
            ← Back to Overview
          </button>
          <button
            onClick={handleTogglePin}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
              company.featured
                ? "bg-[#7C3AED]/10 text-[#7C3AED]"
                : "bg-black/5 text-[#2B2740]/60 hover:text-[#2B2740]"
            }`}
          >
            <Star
              size={13}
              className={company.featured ? "fill-[#7C3AED]" : ""}
            />
            <span>{company.featured ? "Pinned on Home" : "Pin to Home"}</span>
          </button>
        </div>

        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base text-white shadow-xs overflow-hidden flex-shrink-0"
            style={{
              backgroundColor: company.logo ? "transparent" : company.color,
            }}
          >
            {company.logo ? (
              <img
                src={company.logo}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-[#2B2740] truncate">
              {company.name}
            </h2>
            {company.description ? (
              <p className="text-xs text-[#2B2740]/60 mt-0.5">
                {company.description}
              </p>
            ) : (
              <p className="text-[11px] text-[#2B2740]/40 mt-0.5">
                {bills.length} {bills.length === 1 ? "bill" : "bills"} listed
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] text-xs">
          <span className="font-bold text-[#2B2740]/60">Total Unpaid Due:</span>
          <span className="font-mono font-extrabold text-base text-[#7C3AED]">
            {formatCurrency(totalDue, state.currency.symbol)}
          </span>
        </div>
      </div>

      {/* Bills List for this Company */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#2B2740]">
            Bills for {company.name} ({bills.length})
          </h3>
          <button
            onClick={() => onNavigate("addbill")}
            className="text-xs font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
          >
            <Plus size={13} />
            <span>Add Bill</span>
          </button>
        </div>

        {bills.length > 0 ? (
          bills.map((b) => {
            const rem = getRemaining(b);
            const isPaid = rem <= 0;

            return (
              <div
                key={b.id}
                onClick={() => onNavigate(`billdetail:${b.id}`)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs text-[#2B2740] truncate">
                    {b.name}
                  </div>
                  <div className="text-[11px] text-[#2B2740]/50 mt-0.5">
                    Due day {b.dueDay} • {b.month} {b.year}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-extrabold text-sm text-[#2B2740]">
                    {formatCurrency(rem, state.currency.symbol)}
                  </div>
                  <div
                    className={`text-[10px] font-bold mt-0.5 ${
                      isPaid ? "text-[#30A46C]" : "text-[#E5484D]"
                    }`}
                  >
                    {isPaid ? "Settled" : "Unpaid"}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center text-xs text-[#2B2740]/50 border border-black/[0.04]">
            No bills added for this company yet.
          </div>
        )}
      </div>
    </div>
  );
};

