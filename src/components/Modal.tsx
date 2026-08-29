import React from "react";

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2B2740] text-white px-5 py-3 rounded-full text-[13px] font-bold shadow-xl z-50 animate-[toastIn_0.22s_ease_forwards] pointer-events-none whitespace-nowrap">
      {message}
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isAlert?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ModalProps> = ({
  isOpen,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isAlert = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#141028]/45 flex items-center justify-center z-50 p-6 backdrop-blur-[2px]">
      <div className="bg-white rounded-[22px] p-6 max-w-sm w-full shadow-2xl border border-black/5">
        <p className="text-[14.5px] leading-relaxed text-[#2B2740] mb-5 font-medium">{message}</p>
        <div className="flex gap-3">
          {!isAlert && onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-black/[0.05] text-[#2B2740]/60 hover:bg-black/[0.08] transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white shadow-md transition-transform active:scale-95 ${
              isAlert ? "bg-[#7C3AED] hover:bg-[#6D3AED]" : "bg-[#E5484D] hover:bg-[#D93D42]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
