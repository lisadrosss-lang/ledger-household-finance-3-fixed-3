import React, { useState, useRef } from "react";
import { AppState, Bill, PaymentEntry } from "../../types";
import {
  formatCurrency,
  getPaymentStatus,
  getRemaining,
  dueToISO,
  isoToDue,
  CURRENT_MONTH,
  CURRENT_YEAR,
} from "../../lib/storage";
import { optimizeAndConvertToPdf, optimizeLogoImage } from "../../lib/fileOptimizer";
import {
  Copy,
  Check,
  Trash2,
  Edit3,
  Upload,
  FileText,
  Download,
  ExternalLink,
  Calendar,
  Users,
} from "lucide-react";
import {
  loadReminderRecipients,
  buildGoogleCalendarUrl,
  generateSingleIcs,
  downloadIcsFile,
} from "../../lib/calendar";
import { uploadBillAttachment } from "../../lib/supabase";

interface BillDetailViewProps {
  billId: number;
  state: AppState;
  onNavigate: (view: string) => void;
  onUpdateBill: (updated: Bill) => void;
  onDeleteBill: (id: number) => void;
  onAddPayment: (billId: number, amount: number, paidBy: string, isPlan: boolean) => void;
  onDeletePayment: (billId: number, paymentId: number) => void;
  onShowToast: (msg: string) => void;
  onGoBack: () => void;
}

export const BillDetailView: React.FC<BillDetailViewProps> = ({
  billId,
  state,
  onNavigate,
  onUpdateBill,
  onDeleteBill,
  onAddPayment,
  onDeletePayment,
  onShowToast,
  onGoBack,
}) => {
  const bill = state.bills.find((b) => b.id === billId);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState(bill?.name || "");
  const [editCategory, setEditCategory] = useState(bill?.category || "");
  const [editAmount, setEditAmount] = useState(bill?.amount?.toString() || "0");
  const [editPaidAmount, setEditPaidAmount] = useState(bill?.paidAmount?.toString() || "0");
  const [editDueIso, setEditDueIso] = useState(dueToISO(bill?.due || "", bill?.year || CURRENT_YEAR));
  const [editIban, setEditIban] = useState(bill?.iban || "");
  const [editRef, setEditRef] = useState(bill?.reference || "");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentBy, setPaymentBy] = useState("");
  const [attachmentCount, setAttachmentCount] = useState((bill?.photos?.length || (bill?.photo ? 1 : 0)));
  const [isPlan, setIsPlan] = useState(bill?.paymentPlan || false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [notesText, setNotesText] = useState("");
  const [copiedIban, setCopiedIban] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  if (!bill) {
    return (
      <div className="text-center py-12 text-[#2B2740]/60">
        <p>Bill not found.</p>
        <button onClick={onGoBack} className="mt-4 text-[#7C3AED] font-bold text-sm">
          ← Back to bills
        </button>
      </div>
    );
  }

  const category = state.categories.find((c) => c.id === bill.category);
  const status = getPaymentStatus(bill);
  const rem = getRemaining(bill);
  const initial = (category ? category.name : bill.name).trim()[0]?.toUpperCase() || "B";
  const logoToUse = bill.logo || category?.logo || null;

  let bannerCls = "bg-[#A64BC9]/10 text-[#7C3AED]";
  let bannerText = `Not paid yet — due ${bill.due}`;

  if (status === "paid") {
    bannerCls = "bg-emerald-500/15 text-[#2E9E71]";
    bannerText = `Paid in full${bill.paidBy ? ` by ${bill.paidBy}` : ""}`;
  } else if (status === "partial") {
    bannerCls = "bg-amber-400/20 text-[#B0740E]";
    bannerText = `Partially paid — ${formatCurrency(rem, state.currency.symbol)} still owed${
      bill.paidBy ? ` (paid by ${bill.paidBy})` : ""
    }`;
  } else if (bill.timing === "overdue") {
    bannerCls = "bg-[#E5484D]/15 text-[#E5484D]";
    bannerText = `Not paid — was due ${bill.due}`;
  }

  const handleSaveDetails = () => {
    const { due, month, year } = isoToDue(editDueIso);
    const totalAmount = Number(editAmount);
    const paidAmount = Number(editPaidAmount);
    if (
      !totalAmount ||
      totalAmount <= 0 ||
      Number.isNaN(paidAmount) ||
      paidAmount < 0 ||
      paidAmount > totalAmount
    ) {
      onShowToast("Please enter valid total and paid amounts");
      return;
    }
    const updated: Bill = {
      ...bill,
      name: editName.trim() || bill.name,
      category: editCategory || bill.category,
      amount: totalAmount,
      paidAmount,
      paidBy: paidAmount > 0 ? bill.paidBy : null,
      payments: paidAmount === bill.paidAmount
        ? bill.payments
        : paidAmount === 0
        ? []
        : [{
            id: bill.payments?.[0]?.id || Date.now(),
            amount: paidAmount,
            paidBy: bill.paidBy,
            month: bill.month,
            year: bill.year,
          }],
      due,
      month,
      year,
      iban: editIban.trim() || null,
      reference: editRef.trim() || null,
    };
    onUpdateBill(updated);
    setIsEditingDetails(false);
    onShowToast("Bill details updated");
    if (updated.category) {
      onNavigate(`company:${updated.category}`);
    }
  };

  const handleAddPaymentSubmit = () => {
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      onShowToast("Please enter an amount greater than 0");
      return;
    }
    onAddPayment(bill.id, amt, paymentBy.trim(), isPlan);
    setPaymentAmount("");
    setPaymentBy("");
  };

  const handleSaveNote = () => {
    if (!notesText.trim()) return;
    const updatedNotes = bill.notes ? `${bill.notes}\n${notesText.trim()}` : notesText.trim();
    onUpdateBill({ ...bill, notes: updatedNotes });
    setNotesText("");
    onShowToast("Note saved");
  };

  const handleSavePaymentAmount = (paymentId: number) => {
    const amount = Number(editPaymentAmount);
    if (!amount || amount <= 0) {
      onShowToast("Please enter a valid payment amount");
      return;
    }
    const payments = (bill.payments || []).map((payment) =>
      payment.id === paymentId ? { ...payment, amount } : payment
    );
    const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    onUpdateBill({
      ...bill,
      payments,
      paidAmount,
    });
    setEditingPaymentId(null);
    setEditPaymentAmount("");
    onShowToast("Payment amount updated");
  };

  const handleEscalationChange = (val: "reminder" | "aanmaning" | "deurwaarder" | null) => {
    onUpdateBill({ ...bill, escalation: val });
    onShowToast("Collection status updated");
  };

  const handleCopyIban = () => {
    if (bill.iban && navigator.clipboard) {
      navigator.clipboard.writeText(bill.iban);
      setCopiedIban(true);
      onShowToast("IBAN copied to clipboard");
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeLogoImage(file, 400, 0.85);
      onUpdateBill({ ...bill, logo: optimized.data });
      onShowToast(`Logo updated (${optimized.savingsText})`);
    } catch {
      onShowToast("Failed to process logo image");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const existingPhotos = bill.photos || (bill.photo ? [bill.photo] : []);
    if (existingPhotos.length >= 3) {
      onShowToast("A bill can have up to 3 pages");
      e.target.value = "";
      return;
    }
    try {
      const uploaded = await uploadBillAttachment(file);
      const photos = [...existingPhotos, {
        type: file.type || "application/octet-stream", name: file.name, data: uploaded.url,
      }].slice(0, 3);
      onUpdateBill({
        ...bill,
        photo: photos[0] || null,
        photos,
      });
      setAttachmentCount(photos.length);
      onShowToast(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "PDF uploaded and attached" : "File uploaded and attached");
    } catch (error: any) {
      try {
        const optimized = await optimizeAndConvertToPdf(file, 1600, 0.82);
        onUpdateBill({
          ...bill,
          photo: optimized,
          photos: [...existingPhotos, optimized].slice(0, 3),
        });
        setAttachmentCount(Math.min(3, existingPhotos.length + 1));
        onShowToast(`Converted to PDF (${optimized.savingsText})`);
      } catch {
        onShowToast(error?.message || "Failed to process attachment");
      }
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleOpenDocument = (dataUrl: string, fileName: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(
        `<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
      );
      newWindow.document.title = fileName;
    } else {
      // Fallback: download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    }
  };

  const handleDownloadDocument = async (dataUrl: string, fileName: string) => {
    try {
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Attachment download failed:", error);
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      onShowToast("The file opened in a new tab. Use the browser download button to save it.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center gap-3.5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl text-white flex-shrink-0 shadow-sm overflow-hidden"
          style={{ backgroundColor: logoToUse ? "transparent" : category?.color || "#999" }}
        >
          {logoToUse ? (
            <img src={logoToUse} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-base text-[#2B2740] leading-tight truncate">
            {bill.name}
          </h2>
          <div className="flex items-center gap-3 mt-1 text-xs font-bold text-[#7C3AED]">
            <button
              onClick={() => logoInputRef.current?.click()}
              className="hover:underline flex items-center gap-1"
            >
              <Upload size={12} />
              <span>{bill.logo ? "Change logo" : "Add logo"}</span>
            </button>
            {bill.logo && (
              <button
                onClick={() => onUpdateBill({ ...bill, logo: null })}
                className="text-[#E5484D] hover:underline"
              >
                Remove
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>

        <button
          onClick={() => {
            setEditName(bill.name);
            setEditCategory(bill.category);
            setEditAmount(bill.amount.toString());
            setEditPaidAmount(bill.paidAmount.toString());
            setEditDueIso(dueToISO(bill.due, bill.year));
            setEditIban(bill.iban || "");
            setEditRef(bill.reference || "");
            setIsEditingDetails(!isEditingDetails);
          }}
          className="text-xs font-bold text-[#7C3AED] px-3 py-1.5 rounded-full bg-[#7C3AED]/10 hover:bg-[#7C3AED]/15 flex items-center gap-1"
        >
          <Edit3 size={13} />
          <span>Edit</span>
        </button>
      </div>

      {/* Edit Details Inline Card */}
      {isEditingDetails && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#7C3AED]/30 space-y-3">
          <div>
            <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Bill name</div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Category</div>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white focus:outline-none focus:border-[#7C3AED]"
            >
              {state.categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Total bill amount</div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Paid amount</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editPaidAmount}
                onChange={(e) => setEditPaidAmount(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono focus:outline-none focus:border-[#7C3AED]"
              />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Due date</div>
            <input
              type="date"
              value={editDueIso}
              onChange={(e) => setEditDueIso(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Payment IBAN</div>
            <input
              type="text"
              value={editIban}
              onChange={(e) => setEditIban(e.target.value)}
              placeholder="e.g. NL91ABNA0417164300"
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-[#2B2740]/60 mb-1">Payment reference</div>
            <input
              type="text"
              value={editRef}
              onChange={(e) => setEditRef(e.target.value)}
              placeholder="e.g. Reference number"
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveDetails}
              className="flex-1 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditingDetails(false)}
              className="flex-1 py-2.5 rounded-full bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bill Document Preview */}
      <div className="bg-gradient-to-br from-white to-[#F4F3FB] rounded-2xl p-4 shadow-sm border border-black/[0.06]">
        {bill.photo ? (
          <div className="space-y-3">
            {bill.photo.type === "application/pdf" || bill.photo.name.toLowerCase().endsWith(".pdf") ? (
              <div className="bg-white rounded-xl p-4 border border-[#7C3AED]/20 shadow-xs flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <div className="min-w-0 max-w-full">
                  <div className="text-xs font-extrabold text-[#2B2740] truncate max-w-[260px]">
                    {bill.photo.name}
                  </div>
                  <div className="text-[11px] text-[#2E9E71] font-semibold">
                    Standardized PDF Document
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleOpenDocument(bill.photo!.data, bill.photo!.name)}
                    className="px-3.5 py-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D3AED] flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ExternalLink size={12} />
                    <span>View PDF</span>
                  </button>
                  <button
                    onClick={() => handleDownloadDocument(bill.photo!.data, bill.photo!.name)}
                    className="px-3.5 py-1.5 rounded-full bg-black/5 text-[#2B2740] text-xs font-bold hover:bg-black/10 flex items-center gap-1.5 transition-all"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ) : bill.photo.type.startsWith("image/") ? (
              <div className="space-y-2">
                <div className="relative group">
                  <img
                    src={bill.photo.data}
                    alt="Attached invoice"
                    className="w-full rounded-xl max-h-56 object-contain bg-black/5"
                  />
                </div>
                <button
                  onClick={() => handleDownloadDocument(bill.photo!.data, bill.photo!.name)}
                  className="w-full px-3.5 py-1.5 rounded-full bg-black/5 text-[#2B2740] text-xs font-bold hover:bg-black/10 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download size={12} />
                  <span>Download image</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-4 border border-[#7C3AED]/20 shadow-xs flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <div className="min-w-0 max-w-full">
                  <div className="text-xs font-extrabold text-[#2B2740] truncate max-w-[260px]">
                    {bill.photo.name}
                  </div>
                  <div className="text-[11px] text-[#2E9E71] font-semibold">
                    Attached file
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleOpenDocument(bill.photo!.data, bill.photo!.name)}
                    className="px-3.5 py-1.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D3AED] flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ExternalLink size={12} />
                    <span>Open file</span>
                  </button>
                  <button
                    onClick={() => handleDownloadDocument(bill.photo!.data, bill.photo!.name)}
                    className="px-3.5 py-1.5 rounded-full bg-black/5 text-[#2B2740] text-xs font-bold hover:bg-black/10 flex items-center gap-1.5 transition-all"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center text-xs text-[#2B2740]/60 pt-1">
              <button
                onClick={() => photoInputRef.current?.click()}
                className="text-[#7C3AED] font-bold hover:underline"
              >
                {attachmentCount < 3 ? "Add or replace file" : "Replace file"}
              </button>
              <button
                onClick={() => onUpdateBill({ ...bill, photo: null })}
                className="text-[#E5484D] font-bold hover:underline"
              >
                Remove file
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 border border-dashed border-black/15">
            <div className="text-[10.5px] uppercase tracking-wider text-[#2B2740]/50 font-bold mb-1">
              {category?.name || "Invoice"}
            </div>
            <div className="font-extrabold text-base text-[#2B2740] mb-3">{bill.name}</div>
            <div className="h-2 rounded bg-black/[0.06] w-3/5 mb-2" />
            <div className="h-2 rounded bg-black/[0.06] w-2/5 mb-4" />
            <div className="flex justify-between items-center pt-3 border-t border-black/[0.08] font-extrabold text-sm text-[#2B2740]">
              <span>Total due</span>
              <span className="font-mono">{formatCurrency(bill.amount, state.currency.symbol)}</span>
            </div>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full mt-3 py-2 text-center text-xs font-bold text-[#7C3AED] bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <FileText size={14} />
              <span>+ Attach Photo / Invoice (Auto-converts to PDF)</span>
            </button>
          </div>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,application/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />
      </div>

      {/* Status Banner */}
      <div className={`flex items-center justify-between p-3.5 rounded-2xl font-bold text-sm ${bannerCls}`}>
        <span>{bannerText}</span>
      </div>

      {/* Amount Breakdown */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden text-center">
        <div className="flex-1 p-3.5">
          <div className="text-[10px] font-bold text-[#2B2740]/50 uppercase tracking-wider mb-1">Total</div>
          <div className="font-mono font-extrabold text-base text-[#2B2740]">
            {formatCurrency(bill.amount, state.currency.symbol)}
          </div>
        </div>
        <div className="flex-1 p-3.5 border-l border-black/[0.06]">
          <div className="text-[10px] font-bold text-[#2B2740]/50 uppercase tracking-wider mb-1">Paid</div>
          <div className="font-mono font-extrabold text-base text-[#2E9E71]">
            {formatCurrency(bill.paidAmount, state.currency.symbol)}
          </div>
        </div>
        <div className="flex-1 p-3.5 border-l border-black/[0.06]">
          <div className="text-[10px] font-bold text-[#2B2740]/50 uppercase tracking-wider mb-1">Remaining</div>
          <div className="font-mono font-extrabold text-base text-[#E5484D]">
            {formatCurrency(rem, state.currency.symbol)}
          </div>
        </div>
      </div>

      {/* Record Payment Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] space-y-3">
        <div className="text-xs font-bold text-[#2B2740]/60">Record a payment</div>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="Amount (€)"
            className="flex-1 p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
          />
          <input
            type="text"
            value={paymentBy}
            onChange={(e) => setPaymentBy(e.target.value)}
            placeholder="Paid by (name)"
            className="flex-1 p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
          />
        </div>
        <button
          onClick={handleAddPaymentSubmit}
          className="w-full py-3 rounded-full bg-[#7C3AED] text-white font-bold text-sm shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
        >
          Add payment
        </button>
        <label className="flex items-center gap-2 text-xs text-[#2B2740]/60 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={isPlan}
            onChange={(e) => {
              setIsPlan(e.target.checked);
              onUpdateBill({ ...bill, paymentPlan: e.target.checked });
            }}
            className="rounded text-[#7C3AED]"
          />
          <span>This is a payment plan (instalments)</span>
        </label>
      </div>

      {/* Who Paid What History */}
      {bill.payments && bill.payments.length > 0 && (
        <div>
          <div className="text-xs font-bold text-[#2B2740]/60 mb-2.5">Who paid what</div>
          <div className="space-y-2">
            {bill.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white rounded-2xl p-3.5 shadow-sm border border-black/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#B0459E]/10 flex items-center justify-center text-base">
                    💶
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#2B2740]">
                      {p.paidBy || "Unspecified"}
                    </div>
                    <div className="text-xs text-[#2B2740]/50">
                      {p.month} {p.year}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {editingPaymentId === p.id ? (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editPaymentAmount}
                      onChange={(event) => setEditPaymentAmount(event.target.value)}
                      onBlur={() => handleSavePaymentAmount(p.id)}
                      autoFocus
                      className="w-24 p-1.5 rounded-lg border border-[#7C3AED]/40 text-sm font-mono"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingPaymentId(p.id);
                        setEditPaymentAmount(String(p.amount));
                      }}
                      className="font-mono font-bold text-sm text-[#2B2740] hover:text-[#7C3AED]"
                      title="Edit payment amount"
                    >
                      {formatCurrency(p.amount, state.currency.symbol)}
                    </button>
                  )}
                  <button
                    onClick={() => onDeletePayment(bill.id, p.id)}
                    className="text-[#2B2740]/40 hover:text-[#E5484D] text-lg font-bold px-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar & Household Reminders */}
      <div className="bg-[#7C3AED]/[0.05] rounded-2xl p-4 border border-[#7C3AED]/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center">
              <Calendar size={14} />
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#2B2740]">Calendar Reminder & Invites</div>
              <div className="text-[10.5px] text-[#2B2740]/60">Schedule due date alarms on your calendars</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              const recs = loadReminderRecipients();
              const url = buildGoogleCalendarUrl(bill, state.currency.symbol, recs);
              window.open(url, "_blank", "noopener,noreferrer");
              onShowToast("Opened Google Calendar event");
            }}
            className="p-2.5 bg-white rounded-xl border border-black/[0.08] hover:border-[#7C3AED] text-left shadow-xs transition-all flex items-center gap-2 group"
          >
            <ExternalLink size={14} className="text-[#7C3AED] flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#2B2740] group-hover:text-[#7C3AED] truncate">Google Calendar</div>
              <div className="text-[10px] text-[#2B2740]/50">Includes household invitees</div>
            </div>
          </button>

          <button
            onClick={() => {
              const recs = loadReminderRecipients();
              const ics = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Ledger Household App//Bill Reminder//EN",
                generateSingleIcs(bill, state.currency.symbol, recs),
                "END:VCALENDAR",
              ].join("\r\n");
              downloadIcsFile(`Bill_${bill.name.replace(/\s+/g, "_")}.ics`, ics);
              onShowToast("Downloaded .ICS Calendar File (Apple/Outlook/Google)");
            }}
            className="p-2.5 bg-white rounded-xl border border-black/[0.08] hover:border-[#7C3AED] text-left shadow-xs transition-all flex items-center gap-2 group"
          >
            <Download size={14} className="text-[#7C3AED] flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#2B2740] group-hover:text-[#7C3AED] truncate">Download .ICS</div>
              <div className="text-[10px] text-[#2B2740]/50">Alarms 1d & 3d prior</div>
            </div>
          </button>
        </div>
      </div>

      {/* Reminder / Escalation Status */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] space-y-2">
        <div className="text-xs font-bold text-[#2B2740]/60">Reminder / collection status</div>
        <div className="flex gap-2 flex-wrap">
          {[
            { val: null, label: "No reminder", activeCls: "bg-emerald-500/15 text-[#2E9E71]" },
            { val: "reminder" as const, label: "Reminder sent", activeCls: "bg-[#7C3AED]/15 text-[#7C3AED]" },
            { val: "aanmaning" as const, label: "Aanmaning sent", activeCls: "bg-amber-400/20 text-[#B0740E]" },
            { val: "deurwaarder" as const, label: "Deurwaarder", activeCls: "bg-[#7A1F2B] text-white" },
          ].map((opt) => {
            const isActive = bill.escalation === opt.val;
            return (
              <button
                key={opt.label}
                onClick={() => handleEscalationChange(opt.val)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                  isActive ? opt.activeCls : "bg-black/[0.04] text-[#2B2740]/60 hover:bg-black/[0.08]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* IBAN & Reference Details */}
      {(bill.iban || bill.reference) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] space-y-2.5">
          {bill.iban && (
            <div>
              <div className="text-xs font-bold text-[#2B2740]/50 mb-1">Payment IBAN</div>
              <div className="flex items-center justify-between bg-black/[0.03] p-2.5 rounded-xl">
                <span className="font-mono text-sm font-bold text-[#2B2740] tracking-wide truncate mr-2">
                  {bill.iban}
                </span>
                <button
                  onClick={handleCopyIban}
                  className="flex items-center gap-1 px-3 py-1 bg-[#7C3AED] text-white rounded-lg text-xs font-bold hover:bg-[#6D3AED]"
                >
                  {copiedIban ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedIban ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          )}
          {bill.reference && (
            <div className="pt-1">
              <div className="text-xs font-bold text-[#2B2740]/50 mb-0.5">Reference</div>
              <div className="font-mono text-xs font-bold text-[#2B2740]">{bill.reference}</div>
            </div>
          )}
        </div>
      )}

      {/* Notes Section */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.06] space-y-3">
        <div className="text-xs font-bold text-[#2B2740]/60">Notes</div>
        {bill.notes && (
          <div className="p-3 bg-black/[0.03] rounded-xl text-xs text-[#2B2740] whitespace-pre-wrap leading-relaxed">
            {bill.notes}
          </div>
        )}
        <textarea
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Add a note about this bill..."
          className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED] min-h-[50px]"
        />
        <button
          onClick={handleSaveNote}
          className="px-5 py-2 rounded-full bg-[#7C3AED] text-white font-bold text-xs hover:bg-[#6D3AED]"
        >
          Save note
        </button>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2 pt-2">
        {status !== "paid" ? (
          <button
            onClick={() => {
              onUpdateBill({ ...bill, paidAmount: bill.amount });
              onShowToast("Marked as fully paid");
            }}
            className="w-full py-4 rounded-2xl bg-[#7C3AED] text-white font-extrabold text-sm shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
          >
            Mark as fully paid
          </button>
        ) : (
          <button
            onClick={() => {
              onUpdateBill({ ...bill, paidAmount: 0, payments: [] });
              onShowToast("Marked as unpaid");
            }}
            className="w-full py-3.5 rounded-2xl bg-white border border-black/10 text-[#2B2740]/70 font-bold text-sm hover:bg-black/5 active:scale-95 transition-all"
          >
            Mark as unpaid
          </button>
        )}

        <button
          onClick={() => onDeleteBill(bill.id)}
          className="w-full py-2.5 text-center text-[#E5484D] font-bold text-xs hover:underline flex items-center justify-center gap-1"
        >
          <Trash2 size={13} />
          <span>Remove this bill</span>
        </button>
      </div>
    </div>
  );
};
