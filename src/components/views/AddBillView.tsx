import React, { useState, useRef } from "react";
import { AppState, Bill, PaymentEntry, BillPhoto, BillExtractionResult } from "../../types";
import { formatCurrency, isoToDue, CURRENT_MONTH, CURRENT_YEAR } from "../../lib/storage";
import { optimizeAndConvertToPdf } from "../../lib/fileOptimizer";
import {
  Sparkles,
  Camera,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { uploadBillAttachment, uploadBillAttachmentData } from "../../lib/supabase";

interface AddBillViewProps {
  state: AppState;
  presetCategory?: string | null;
  onAddBill: (newBill: Bill) => void;
  onShowToast: (msg: string) => void;
  onGoBack: () => void;
}

export const AddBillView: React.FC<AddBillViewProps> = ({
  state,
  presetCategory,
  onAddBill,
  onShowToast,
  onGoBack,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState(presetCategory || state.categories[0]?.id || "housing");
  const [amountStr, setAmountStr] = useState("");
  const [dueDateIso, setDueDateIso] = useState("");

  // Step 2 fields
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [statusOverride, setStatusOverride] = useState<"auto" | "urgent" | "upcoming">("auto");
  const [escalation, setEscalation] = useState<"reminder" | "aanmaning" | "deurwaarder" | null>(null);
  const [iban, setIban] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [attachedPhoto, setAttachedPhoto] = useState<BillPhoto | null>(null);
  const [attachedPhotos, setAttachedPhotos] = useState<BillPhoto[]>([]);

  // AI Extraction State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<BillExtractionResult | null>(null);
  const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);

  // Validation errors
  const [nameError, setNameError] = useState("");
  const [amountError, setAmountError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const manualFileRef = useRef<HTMLInputElement>(null);

  // AI Bill Scanner handler
  const processImageWithAi = async (file: File) => {
    if (!file) return;
    setIsScanning(true);
    setScanResult(null);

    // Create immediate local preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      setPreviewThumbnail(base64Data);

      try {
        const optimized = await optimizeAndConvertToPdf(file);
        const uploaded = await uploadBillAttachmentData(
          optimized.data,
          optimized.name,
          optimized.type
        );
        const attached = { type: optimized.type, name: optimized.name, data: uploaded.url };
        setAttachedPhoto(attached);
        setAttachedPhotos((current) => current.length < 3 ? [...current, attached] : current);

        const res = await fetch("/api/gemini/extract-bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: optimized.data,
            mimeType: optimized.type,
            categories: state.categories,
            currencySymbol: state.currency.symbol,
          }),
        });

        const responseData = await res.json();
        if (responseData.success && responseData.data) {
          const result: BillExtractionResult = responseData.data;
          setScanResult(result);

          const { extractedData, needsRetake, isBill } = result;

          if (isBill && !needsRetake) {
            // Populate detected fields
            if (extractedData.name) setName(extractedData.name);
            if (extractedData.category) {
              const matchedCat = state.categories.find(
                (c) => c.id.toLowerCase() === extractedData.category?.toLowerCase()
              );
              if (matchedCat) setCategory(matchedCat.id);
            }
            if (extractedData.amount !== null && extractedData.amount !== undefined && extractedData.amount > 0) {
              setAmountStr(String(extractedData.amount));
            }
            if (extractedData.dueDateIso) {
              setDueDateIso(extractedData.dueDateIso);
            }
            if (extractedData.iban) setIban(extractedData.iban);
            if (extractedData.reference) setReference(extractedData.reference);
            if (extractedData.escalation) setEscalation(extractedData.escalation);
            if (extractedData.notes) setNotes(extractedData.notes);

            if (result.missingFields && result.missingFields.length > 0) {
              onShowToast("Extracted! Please verify the missing fields highlighted in yellow.");
            } else {
              onShowToast("✨ All bill details extracted by AI!");
            }
          } else {
            onShowToast(result.userActionPrompt || "Photo is unclear. Please take another picture or enter details.");
          }
        } else {
          onShowToast("Could not extract bill details. Please check and fill manually.");
        }
      } catch (err: any) {
        console.error("AI scanning error:", err);
        onShowToast("AI extraction unavailable right now. Please enter bill details manually.");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageWithAi(file);
    }
  };

  const handleNextStep = () => {
    let hasErr = false;
    if (!name.trim()) {
      setNameError("Bill name is required.");
      hasErr = true;
    } else {
      setNameError("");
    }

    const amt = parseFloat(amountStr);
    if (!amountStr || isNaN(amt) || amt <= 0) {
      setAmountError(`Enter an amount greater than ${state.currency.symbol}0.`);
      hasErr = true;
    } else {
      setAmountError("");
    }

    if (hasErr) {
      onShowToast("Please fill in the required fields");
      return;
    }

    setStep(2);
  };

  const handleManualAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attachedPhotos.length >= 3) {
      onShowToast("A bill can have up to 3 pages");
      e.target.value = "";
      return;
    }
    try {
      const uploaded = await uploadBillAttachment(file);
      const photo = {
        type: file.type || "application/octet-stream",
        name: file.name,
        data: uploaded.url,
      };
      setAttachedPhotos((current) => current.length < 3 ? [...current, photo] : current);
      setAttachedPhoto(photo);
      onShowToast(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "PDF uploaded and attached" : "File uploaded and attached");
    } catch (error: any) {
      try {
        const optimized = await optimizeAndConvertToPdf(file);
        const photo = {
          type: optimized.type,
          name: optimized.name,
          data: optimized.data,
        };
        setAttachedPhotos((current) => current.length < 3 ? [...current, photo] : current);
        setAttachedPhoto(photo);
        onShowToast(`Converted & resized to PDF (${optimized.savingsText})`);
      } catch {
        onShowToast(error?.message || "Failed to process attachment");
      }
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleSubmit = () => {
    const amt = parseFloat(amountStr);
    const paidAmt = parseFloat(paidAmountStr) || 0;
    const { due, month, year } = isoToDue(dueDateIso);

    let timing: "overdue" | "upcoming" = "upcoming";
    if (statusOverride === "urgent") timing = "overdue";
    else if (statusOverride === "upcoming") timing = "upcoming";
    else {
      if (year < CURRENT_YEAR) timing = "overdue";
      else timing = "upcoming";
    }

    const newId = Date.now();
    const payments: PaymentEntry[] =
      paidAmt > 0
        ? [
            {
              id: 1,
              amount: paidAmt,
              paidBy: "User",
              month,
              year,
            },
          ]
        : [];

    const newBill: Bill = {
      id: newId,
      name: name.trim(),
      category,
      amount: amt,
      paidAmount: paidAmt,
      due,
      month,
      year,
      timing,
      photo: attachedPhoto,
      photos: attachedPhotos.length > 0 ? attachedPhotos : attachedPhoto ? [attachedPhoto] : [],
      logo: null,
      paymentPlan: false,
      notes: notes.trim(),
      paidBy: paidAmt > 0 ? "User" : null,
      escalation,
      iban: iban.trim() || null,
      reference: reference.trim() || null,
      payments,
      sortOrder: (state.bills.length || 0) + 1,
    };

    onAddBill(newBill);
    onShowToast("Bill added successfully");
  };

  // Helper check for missing AI field highlight
  const isMissing = (fieldName: string) => {
    if (!scanResult) return false;
    return scanResult.missingFields?.includes(fieldName);
  };

  return (
    <div className="bg-white rounded-[22px] p-5 shadow-sm border border-black/[0.06] space-y-4">
      {/* Hidden File Inputs for AI Scan */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,application/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Progress Dots */}
      <div className="flex justify-between items-center mb-1">
        <button
          type="button"
          onClick={onGoBack}
          className="text-xs font-semibold text-[#2B2740]/60 hover:text-[#2B2740] flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex gap-1.5">
          <span
            className={`h-2 rounded-full transition-all ${
              step === 1 ? "w-6 bg-[#7C3AED]" : "w-2 bg-emerald-500"
            }`}
          />
          <span
            className={`h-2 rounded-full transition-all ${
              step === 2 ? "w-6 bg-[#7C3AED]" : "w-2 bg-black/15"
            }`}
          />
        </div>
        <span className="text-xs font-bold text-[#7C3AED]">Step {step} of 2</span>
      </div>

      {/* AI Smart Extraction Banner (Visible on Step 1) */}
      {step === 1 && (
        <div className="rounded-2xl border border-[#7C3AED]/20 bg-gradient-to-br from-[#7C3AED]/5 via-[#7C3AED]/[0.02] to-transparent p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center shadow-sm">
                <Sparkles size={15} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#2B2740] flex items-center gap-1.5">
                  AI Bill & Invoice Scanner
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-semibold">
                    Auto-Fill
                  </span>
                </h4>
                <p className="text-[11px] text-[#2B2740]/70">
                  Upload or snap a photo of any bill to extract amount, due date & details automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Scanning In-Progress Indicator */}
          {isScanning && (
            <div className="p-3 bg-white rounded-xl border border-[#7C3AED]/30 flex items-center gap-3 animate-pulse">
              <RefreshCw size={18} className="text-[#7C3AED] animate-spin flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#7C3AED]">Scanning & analyzing bill image with Gemini AI...</p>
                <p className="text-[10px] text-[#2B2740]/60">Detecting provider, amount, payment deadline & IBAN...</p>
              </div>
            </div>
          )}

          {/* AI Scan Feedback & Warning Cards */}
          {!isScanning && scanResult && (
            <div className="space-y-2">
              {/* Case 1: Unclear / Needs Retake / Not a Bill */}
              {(!scanResult.isBill || scanResult.needsRetake || scanResult.readability === "unreadable") && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold">Picture unclear or missing key bill information</p>
                      <p className="text-[11px] mt-0.5 text-amber-800">
                        {scanResult.userActionPrompt ||
                          "The image was hard to read. Please take a clearer photo in good light, or enter the missing information manually below."}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-700 active:scale-95 transition-all shadow-sm"
                    >
                      <Camera size={13} /> Retake Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-100/50 active:scale-95 transition-all"
                    >
                      <UploadCloud size={13} /> Upload File
                    </button>
                  </div>
                </div>
              )}

              {/* Case 2: Partial Read (Some fields extracted, some missing) */}
              {scanResult.isBill && !scanResult.needsRetake && scanResult.missingFields?.length > 0 && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold">
                        Partially Extracted ({scanResult.confidenceScore}% confidence)
                      </p>
                      <p className="text-[11px] text-blue-800">
                        {scanResult.userActionPrompt ||
                          "We filled in what was visible. Please check and fill in the missing details highlighted below."}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {scanResult.missingFields.map((field) => (
                          <span
                            key={field}
                            className="px-1.5 py-0.5 bg-blue-200/70 text-blue-900 text-[10px] font-bold rounded"
                          >
                            ⚠️ Missing: {field === "amount" ? "Total Amount" : field === "dueDateIso" ? "Due Date" : field}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Case 3: High Precision Complete Scan */}
              {scanResult.isBill && !scanResult.needsRetake && (!scanResult.missingFields || scanResult.missingFields.length === 0) && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold">✨ Bill successfully extracted by AI!</p>
                      <p className="text-[10px] text-emerald-700">
                        All details verified with {scanResult.confidenceScore}% confidence.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-emerald-800 font-bold hover:underline"
                  >
                    Change photo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons for AI Scan */}
          {!isScanning && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 py-2 px-3 rounded-xl bg-white border border-[#7C3AED]/30 text-[#7C3AED] hover:bg-[#7C3AED]/5 active:scale-95 transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Camera size={14} /> Take Photo
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 px-3 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D3AED] active:scale-95 transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <UploadCloud size={14} /> Upload Bill / PDF
              </button>
            </div>
          )}
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-3.5">
          {/* Bill Name Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#2B2740]/70">
                Bill / Vendor name <span className="text-[#E5484D]">*</span>
              </label>
              {scanResult?.extractedData?.name && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> AI parsed
                </span>
              )}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="e.g. Ziggo, Vattenfall, Belastingdienst"
              className={`w-full p-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                nameError
                  ? "border-[#E5484D] bg-[#E5484D]/5"
                  : isMissing("name")
                  ? "border-amber-300 bg-amber-50/40 focus:border-[#7C3AED]"
                  : "border-black/10 focus:border-[#7C3AED]"
              }`}
            />
            {nameError && <div className="text-[11px] font-bold text-[#E5484D] mt-1">{nameError}</div>}
          </div>

          {/* Company / Category */}
          <div>
            <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
              Category <span className="text-[#E5484D]">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white focus:outline-none focus:border-[#7C3AED]"
            >
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Total Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#2B2740]/70">
                Total Amount ({state.currency.symbol}) <span className="text-[#E5484D]">*</span>
              </label>
              {scanResult?.extractedData?.amount ? (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> AI parsed
                </span>
              ) : isMissing("amount") ? (
                <span className="text-[10px] text-amber-600 font-bold">⚠️ Please fill in</span>
              ) : null}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountStr}
              onChange={(e) => {
                setAmountStr(e.target.value);
                if (amountError) setAmountError("");
              }}
              placeholder="0.00"
              className={`w-full p-2.5 rounded-xl border text-sm font-mono focus:outline-none transition-all ${
                amountError
                  ? "border-[#E5484D] bg-[#E5484D]/5"
                  : isMissing("amount")
                  ? "border-amber-400 bg-amber-50/40 focus:border-[#7C3AED]"
                  : "border-black/10 focus:border-[#7C3AED]"
              }`}
            />
            {amountError && <div className="text-[11px] font-bold text-[#E5484D] mt-1">{amountError}</div>}
          </div>

          {/* Due Date Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#2B2740]/70">Payment Due Date</label>
              {scanResult?.extractedData?.dueDateIso ? (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> AI parsed
                </span>
              ) : isMissing("dueDateIso") ? (
                <span className="text-[10px] text-amber-600 font-bold">⚠️ Please verify</span>
              ) : null}
            </div>
            <input
              type="date"
              value={dueDateIso}
              onChange={(e) => setDueDateIso(e.target.value)}
              className={`w-full p-2.5 rounded-xl border text-sm bg-white focus:outline-none transition-all ${
                isMissing("dueDateIso")
                  ? "border-amber-400 bg-amber-50/40 focus:border-[#7C3AED]"
                  : "border-black/10 focus:border-[#7C3AED]"
              }`}
            />
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            className="w-full py-3.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-sm shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all mt-2 flex items-center justify-center gap-1.5"
          >
            <span>Continue to Payment & Banking Details</span>
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="p-3 bg-[#7C3AED]/5 border border-[#7C3AED]/15 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-[#2B2740]/60 block">Adding Bill</span>
              <strong className="text-sm text-[#2B2740]">{name}</strong>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#2B2740]/60 block">Total Due</span>
              <strong className="text-sm text-[#7C3AED]">
                {formatCurrency(parseFloat(amountStr) || 0, state.currency.symbol)}
              </strong>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
              Already paid amount ({state.currency.symbol}, optional)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={paidAmountStr}
              onChange={(e) => setPaidAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">Status</label>
            <select
              value={statusOverride}
              onChange={(e) => setStatusOverride(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="auto">Automatic (based on due date)</option>
              <option value="urgent">Urgent / Immediate</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#2B2740]/70">
                Reminder / Collection status
              </label>
              {scanResult?.extractedData?.escalation && (
                <span className="text-[10px] text-amber-600 font-bold">
                  ⚠️ AI detected notice: {scanResult.extractedData.escalation}
                </span>
              )}
            </div>
            <select
              value={escalation || ""}
              onChange={(e) => setEscalation((e.target.value as any) || null)}
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm bg-white focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="">No reminder (standard bill)</option>
              <option value="reminder">Reminder sent (Herinnering)</option>
              <option value="aanmaning">Aanmaning (Final Demand)</option>
              <option value="deurwaarder">Deurwaarder (Collection)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#2B2740]/70">
                Payment IBAN (optional)
              </label>
              {scanResult?.extractedData?.iban && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> AI parsed
                </span>
              )}
            </div>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="e.g. NL91ABNA0417164300"
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm font-mono focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-[#2B2740]/70">
                Payment Reference / Betalingskenmerk (optional)
              </label>
              {scanResult?.extractedData?.reference && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> AI parsed
                </span>
              )}
            </div>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. 2026-94812 or invoice #"
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
              Notes / Description (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly internet bill or fine notice"
              className="w-full p-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          {/* Attached Document / Photo Section */}
          <div>
            <label className="text-xs font-bold text-[#2B2740]/70 block mb-1">
              Invoice Document / Receipt
            </label>
            <input
              ref={manualFileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,application/*"
              className="hidden"
              onChange={handleManualAttachment}
            />
            {attachedPhotos.length > 0 ? (
              <div className="p-3 rounded-xl bg-[#7C3AED]/5 border border-[#7C3AED]/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#7C3AED] text-white flex items-center justify-center flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#2B2740] truncate">{attachedPhotos.length} of 3 pages attached</div>
                    <div className="text-[10px] text-[#2E9E71] font-bold flex items-center gap-1">
                      <CheckCircle2 size={10} /> Converted & attached as PDF
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setAttachedPhoto(null); setAttachedPhotos([]); }}
                  className="text-xs font-bold text-[#E5484D] hover:underline flex-shrink-0 ml-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => manualFileRef.current?.click()}
                className="w-full p-3 rounded-xl border border-dashed border-black/20 text-xs font-bold text-[#7C3AED] hover:bg-[#7C3AED]/5 flex items-center justify-center gap-1.5 transition-all"
              >
                <FileText size={14} />
                <span>+ Attach Photo or PDF Invoice (up to 3 pages)</span>
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-3.5 rounded-2xl bg-black/5 text-[#2B2740]/70 font-bold text-sm hover:bg-black/10 transition-all"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-2 py-3.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-sm shadow-md hover:bg-[#6D3AED] active:scale-95 transition-all"
            >
              Save & Add Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
