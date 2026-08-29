import React, { useState, useEffect, useCallback } from "react";
import { AppState, Bill, Category, Account, GroceriesState } from "./types";
import {
  loadInitialState,
  saveStateToStorage,
  CURRENT_MONTH,
  CURRENT_YEAR,
} from "./lib/storage";
import {
  testSupabaseConnection,
} from "./lib/supabase";
import { Header, Sidebar, Tabbar } from "./components/Navigation";
import { Toast, ConfirmModal } from "./components/Modal";
import { HomeView } from "./components/views/HomeView";
import { BillsView } from "./components/views/BillsView";
import { BillDetailView } from "./components/views/BillDetailView";
import { CategoriesView, CompanyDetailView } from "./components/views/CategoriesView";
import { AccountView } from "./components/views/AccountView";
import { TxnDetailView } from "./components/views/TxnDetailView";
import { GroceriesView } from "./components/views/GroceriesView";
import { SyncView } from "./components/views/SyncView";
import { AddBillView } from "./components/views/AddBillView";
import { SettingsView } from "./components/views/SettingsView";
import { HubView } from "./components/views/HubView";
import { MonthlyFeedbackView } from "./components/views/MonthlyFeedbackView";
import { BillReminderModal } from "./components/BillReminderModal";
import { PasswordGateView } from "./components/views/PasswordGateView";
import { Plus } from "lucide-react";

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [navHistory, setNavHistory] = useState<string[]>(["home"]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Password lock state
  const [unlockedSections, setUnlockedSections] = useState<Record<string, boolean>>({});

  // Confirm Modal state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });

  // Supabase connection state indicator
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2200);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  // Check Supabase connection on startup
  useEffect(() => {
    let isMounted = true;
    testSupabaseConnection().then((res) => {
      if (isMounted) {
        setSupabaseConnected(res.success);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const currentView = navHistory[navHistory.length - 1] || "home";
  const [baseView, viewParam] = currentView.split(":");

  const navigateTo = (view: string) => {
    setNavHistory((prev) => [...prev, view]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    if (navHistory.length > 1) {
      setNavHistory((prev) => prev.slice(0, -1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const resetTo = (view: string) => {
    setNavHistory([view]);
    setCategoryFilter(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // State update helpers
  const handleUpdateVerse = (text: string, reference: string) => {
    setState((prev) => ({
      ...prev,
      verse: { text, reference },
    }));
    showToast("Scripture verse updated");
  };

  const handleAddBill = (newBill: Bill) => {
    setState((prev) => {
      let updatedAccounts = prev.accounts;

      // If already paid amount > 0, deduct from Balance account
      if (newBill.paidAmount > 0) {
        const balAcc = updatedAccounts.find((a) => a.id === "balance");
        if (balAcc) {
          const newTxn = {
            id: Date.now(),
            month: newBill.month,
            year: newBill.year,
            note: `${newBill.name} — paid initial`,
            amount: -newBill.paidAmount,
          };
          updatedAccounts = updatedAccounts.map((a) =>
            a.id === "balance" ? { ...a, transactions: [newTxn, ...a.transactions] } : a
          );
        }
      }

      return {
        ...prev,
        bills: [newBill, ...prev.bills],
        accounts: updatedAccounts,
      };
    });

    resetTo("bills");
  };

  const handleUpdateBill = (updated: Bill) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((b) => (b.id === updated.id ? updated : b)),
    }));
  };

  const handleDeleteBill = (id: number) => {
    setModalConfig({
      isOpen: true,
      message: "Are you sure you want to remove this bill? This cannot be undone.",
      confirmLabel: "Remove Bill",
      onConfirm: () => {
        setState((prev) => ({
          ...prev,
          bills: prev.bills.filter((b) => b.id !== id),
        }));
        setModalConfig((m) => ({ ...m, isOpen: false }));
        showToast("Bill removed");
        resetTo("bills");
      },
    });
  };

  const handleAddPayment = (billId: number, amount: number, paidBy: string, isPlan: boolean) => {
    setState((prev) => {
      const bill = prev.bills.find((b) => b.id === billId);
      if (!bill) return prev;

      const newPayment = {
        id: Date.now(),
        amount,
        paidBy: paidBy || null,
        month: CURRENT_MONTH,
        year: CURRENT_YEAR,
      };

      const existingPayments = bill.payments || [];
      const updatedPayments = [...existingPayments, newPayment];
      const newPaidAmount = updatedPayments.reduce((s, p) => s + p.amount, 0);

      // Deduct from Balance account
      const balAcc = prev.accounts.find((a) => a.id === "balance");
      let updatedAccounts = prev.accounts;
      if (balAcc) {
        const newTxn = {
          id: Date.now(),
          month: CURRENT_MONTH,
          year: CURRENT_YEAR,
          note: `${bill.name}${paidBy ? ` — paid by ${paidBy}` : ""}`,
          amount: -amount,
        };
        updatedAccounts = updatedAccounts.map((a) =>
          a.id === "balance" ? { ...a, transactions: [newTxn, ...a.transactions] } : a
        );
      }

      const updatedBill: Bill = {
        ...bill,
        paidAmount: newPaidAmount,
        paidBy: paidBy || bill.paidBy,
        paymentPlan: isPlan,
        payments: updatedPayments,
      };

      return {
        ...prev,
        bills: prev.bills.map((b) => (b.id === billId ? updatedBill : b)),
        accounts: updatedAccounts,
      };
    });

    showToast("Payment recorded and deducted from Balance");
  };

  const handleDeletePayment = (billId: number, paymentId: number) => {
    setState((prev) => {
      const bill = prev.bills.find((b) => b.id === billId);
      if (!bill) return prev;

      const updatedPayments = (bill.payments || []).filter((p) => p.id !== paymentId);
      const newPaidAmount = updatedPayments.reduce((s, p) => s + p.amount, 0);

      return {
        ...prev,
        bills: prev.bills.map((b) =>
          b.id === billId ? { ...b, paidAmount: newPaidAmount, payments: updatedPayments } : b
        ),
      };
    });
    showToast("Payment entry removed");
  };

  const handleAddCategory = (newCat: Category) => {
    setState((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
  };

  const handleUpdateCategory = (updated: Category) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === updated.id ? updated : c)),
    }));
  };

  const handleDeleteCategory = (id: string) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
    showToast("Category removed");
  };

  const handleReorderCategories = (newCategories: Category[]) => {
    setState((prev) => ({
      ...prev,
      categories: newCategories,
    }));
  };

  const handleUpdateAccount = (updated: Account) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === updated.id ? updated : a)),
    }));
  };

  const handleUpdateGroceries = (updated: GroceriesState) => {
    setState((prev) => ({
      ...prev,
      groceries: updated,
    }));
  };

  const handleApplyRemoteState = (updates: Partial<AppState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  // Header Title computation
  const getHeaderTitle = (): string => {
    if (baseView === "home") return "Home";
    if (baseView === "bills") return "All bills";
    if (baseView === "detail") {
      const b = state.bills.find((x) => x.id === Number(viewParam));
      return b ? b.name : "Bill Details";
    }
    if (baseView === "categories") return "Overview";
    if (baseView === "company") {
      const c = state.categories.find((x) => x.id === viewParam);
      return c ? c.name : "Company";
    }
    if (baseView === "account") {
      if (viewParam === "personal") return "Personal Account";
      if (viewParam === "business") return "Business Account";
      const a = state.accounts.find((x) => x.id === viewParam);
      return a ? a.label : "Account";
    }
    if (baseView === "txndetail") return "Transaction";
    if (baseView === "groceries") return "Groceries";
    if (baseView === "feedback") return "Monthly Feedback";
    if (baseView === "sync") return "Sync";
    if (baseView === "addbill") return "Add a bill";
    if (baseView === "settings") return "Settings";
    if (baseView === "hub") return "More pages";
    return "Ledger";
  };

  // Password gate logic for personal & business accounts
  const isProtected = baseView === "account" && (viewParam === "personal" || viewParam === "business");
  const isLocked = isProtected && !unlockedSections[viewParam];

  return (
    <div className="flex min-h-screen bg-[#F6EEF6] text-[#2B2740]">
      {/* Toast Notification */}
      <Toast message={toastMessage} />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig((m) => ({ ...m, isOpen: false }))}
      />

      {/* Bill Reminder & Summary Modal */}
      <BillReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        state={state}
        onUpdateBill={handleUpdateBill}
        onShowToast={showToast}
      />

      {/* Desktop Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={resetTo}
        lang={state.language}
        supabaseConnected={supabaseConnected}
        onOpenReminders={() => setShowReminderModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <Header
          title={getHeaderTitle()}
          canGoBack={navHistory.length > 1}
          onBack={goBack}
          lang={state.language}
          supabaseConnected={supabaseConnected}
          onSyncClick={() => navigateTo("sync")}
        />

        <div className="w-full max-w-xl mx-auto px-4 py-6 md:py-8 pb-28 md:pb-12 content-enter">
          {isLocked ? (
            <PasswordGateView
              sectionName={viewParam === "business" ? "Business Account" : "Personal Account"}
              onUnlock={() =>
                setUnlockedSections((prev) => ({
                  ...prev,
                  [viewParam]: true,
                  personal: true,
                  business: true,
                }))
              }
            />
          ) : baseView === "home" ? (
            <HomeView
              state={state}
              onNavigate={navigateTo}
              onUpdateVerse={handleUpdateVerse}
              onReorderCategories={handleReorderCategories}
            />
          ) : baseView === "bills" ? (
            <BillsView
              state={state}
              onNavigate={navigateTo}
              categoryFilter={categoryFilter}
              onClearCategoryFilter={() => setCategoryFilter(null)}
              onOpenReminders={() => setShowReminderModal(true)}
            />
          ) : baseView === "detail" ? (
            <BillDetailView
              billId={Number(viewParam)}
              state={state}
              onUpdateBill={handleUpdateBill}
              onDeleteBill={handleDeleteBill}
              onAddPayment={handleAddPayment}
              onDeletePayment={handleDeletePayment}
              onShowToast={showToast}
              onGoBack={goBack}
            />
          ) : baseView === "categories" ? (
            <CategoriesView
              state={state}
              onNavigate={navigateTo}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onReorderCategories={handleReorderCategories}
              onShowToast={showToast}
            />
          ) : baseView === "company" ? (
            <CompanyDetailView
              categoryId={viewParam}
              state={state}
              onNavigate={navigateTo}
              onUpdateCategory={handleUpdateCategory}
              onShowToast={showToast}
            />
          ) : baseView === "account" ? (
            <AccountView
              accountId={viewParam}
              state={state}
              onNavigate={navigateTo}
              onUpdateAccount={handleUpdateAccount}
              onShowToast={showToast}
            />
          ) : baseView === "txndetail" ? (
            <TxnDetailView
              param={viewParam}
              state={state}
              onNavigate={navigateTo}
              onUpdateAccount={handleUpdateAccount}
              onShowToast={showToast}
              onGoBack={goBack}
            />
          ) : baseView === "groceries" ? (
            <GroceriesView
              state={state}
              onUpdateGroceries={handleUpdateGroceries}
              onShowToast={showToast}
              onNavigate={navigateTo}
            />
          ) : baseView === "feedback" ? (
            <MonthlyFeedbackView
              state={state}
              onNavigate={navigateTo}
              onShowToast={showToast}
            />
          ) : baseView === "sync" ? (
            <SyncView
              state={state}
              onApplyRemoteState={handleApplyRemoteState}
              onShowToast={showToast}
            />
          ) : baseView === "addbill" ? (
            <AddBillView
              state={state}
              presetCategory={viewParam}
              onAddBill={handleAddBill}
              onShowToast={showToast}
              onGoBack={goBack}
            />
          ) : baseView === "settings" ? (
            <SettingsView
              state={state}
              onUpdateCurrency={(curr) => setState((prev) => ({ ...prev, currency: curr }))}
              onUpdateLanguage={(lang) => setState((prev) => ({ ...prev, language: lang }))}
              onShowToast={showToast}
            />
          ) : baseView === "hub" ? (
            <HubView
              onNavigate={navigateTo}
              lang={state.language}
              onOpenReminders={() => setShowReminderModal(true)}
            />
          ) : (
            <HomeView
              state={state}
              onNavigate={navigateTo}
              onUpdateVerse={handleUpdateVerse}
            />
          )}
        </div>
      </main>

      {/* Floating Action Button for Home and Bills screens */}
      {(baseView === "home" || baseView === "bills") && (
        <button
          onClick={() => navigateTo("addbill")}
          className="fixed right-6 bottom-20 md:bottom-8 bg-gradient-to-br from-[#6D3AED] via-[#B0459E] to-[#F2994A] text-white font-extrabold text-sm py-3.5 px-5 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 z-30"
        >
          <Plus size={18} />
          <span>Add Bill</span>
        </button>
      )}

      {/* Mobile Bottom Tabbar */}
      <Tabbar currentView={currentView} onNavigate={resetTo} lang={state.language} />
    </div>
  );
}
